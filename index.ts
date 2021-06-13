import dotenv from 'dotenv'
dotenv.config();
import express, { Application } from "express";
import path from "path";
import fs from "fs/promises";
import fssync from "fs";
import morgan from "morgan";
var cors = require('cors');
import { Client } from 'pg';
import uploadFile from "./multerUtil";
import Queue from 'bull'; 
import { doesNotMatch } from "assert/strict";
const spawn = require('await-spawn')
var randomstring = require("randomstring");

const PORT = process.env.PORT || 3045;
const client = new Client({
    user: process.env.USER,
    password: process.env.PWD,
    host: process.env.HOST,
    port: parseInt(String(process.env.PORT)),
    database: process.env.DB
});

const gqueue = new Queue('gradeQueue', {
    limiter: {
        max: parseInt(String(process.env.QUEUE_MAX)),
        duration: parseInt(String(process.env.QUEUE_DURATION))
    },
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
    },
});

gqueue.process(async(job: any, done) => {
    let codetest = process.env["CODE_TEST"];
    let returnResult: any;

    if( job.data.snFirst === "code_test") {
        try{
            returnResult = await spawn('python', [job.data.wrapper, job.data.answer, job.data.file, job.data.code]);
        } catch(ex) {
            done(ex.stderr.toString(), null);
        }
    } else {
        try{
            returnResult = await spawn('python', [job.data.wrapper, job.data.answer, job.data.file, job.data.code, job.data.snFirst, job.data.snSecond]);
        } catch(ex) {
            done(ex.stderr.toString(), null);
        }
    }
    done(null, returnResult);
    console.log("gqueue.process end");
});

gqueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed with result ${result}`);

})

gqueue.on('failed', (job, result) => {
    console.log(`Job ${job.id} failed with result ${result}`);
})


async function addJob(data: any): Promise<number> {

    let current: number = await gqueue.getActiveCount();
    let limit : number= parseInt(String(process.env["QUEUE_MAX_LIMIT"]));
    if(current >= limit) {
        return 1;
    }
    await gqueue.add(data);
    return 0;
}

const app: Application = express();
app.use(express.json());
app.use(cors());
app.use(morgan("tiny"));

app.post("/aifactory", async (req, res) => {

    try {
        await uploadFile(req, res);
        if (req.file == undefined) {
            return res.status(400).send("false");
        }
        console.log(req.file);

        // taskid 에 맞는 wrapper.py 파일이름을 db에서 읽어오기 
        // db에서 answer 파일이름 가져오기 , code(채점코드) 이름도 가져오기 
        let wrapper: string = "test.py"; 
        let answer: string = "";
        let code: string = "";
        
        let wrapperPath: string = path.join(String(process.env.SRC_ROOT), req.body.taskId, wrapper);
        let answerPath: string = path.join(String(process.env.SRC_ROOT), req.body.taskId, answer);
        let codePath: string = path.join(String(process.env.SRC_ROOT), req.body.taskId, code);

        let jobdata = {
            wrapper : wrapperPath,
            answer : answerPath,
            file : req.file.path,
            code : codePath,
            task : req.body.taskId,
            snFirst : req.body.snFirst,
            snSecond : req.body.snSecond,
        }
        console.log(jobdata);
        // to do : 결과가 정상이면 wrapper 스크립트안에서 결과파일을 지운다  
        // 오류날 경우 결과파일(제출)을 failed 로 옮긴다
        const result = await addJob(jobdata);
        if( result == 0) {
            res.status(200).send({
                "ct" : "0",
                "result":"success",
            });
        }
        res.status(200).send({
            "ct" : "1",
            "result":"Exceeding the maximum number",
        });
    } catch (ex) {
        res.status(200).send({
            "ct" : "1",
            "result":"failed",
        });    
    }
    
});

app.post("/submit", async (req, res) => {
    
    try{
        await uploadFile(req, res);
        // key를 통해 taskid, userid 
        // 제출 db > row 생성 
        // python 실행 
        let jobdata = {
            wrapper : wrapperPath,
            answer : answerPath,
            file : req.file.path,
            code : codePath,
            task : req.body.taskId,
            snFirst : req.body.snFirst,
            snSecond : req.body.snSecond,
        }
        //console.log(jobdata);
        // to do : 결과가 정상이면 wrapper 스크립트안에서 결과파일을 지운다  
        // 오류날 경우 결과파일(제출)을 failed 로 옮긴다
        const result = await addJob(jobdata);
        if( result == 0) {
            res.status(200).send({"ct" : 0, "result":"success"});
        }else {
            res.status(200).send({"ct" : 1, "result":"Exceeding the maximum number"});
        }
    } catch(ex) {
        res.status(200).send({"ct" : 1, "result":"failed"}); 
    }
});

app.post("/createCalculator", async (req, res) => {
    
    try{
        let codetest = process.env["CODE_TEST"];
        // task id 
        // code file
        // answer file 
        let answerPath: string = path.join(String(process.env.SRC_ROOT), req.body.taskId, req.body.answerFilename);
        let codePath: string = path.join(String(process.env.SRC_ROOT), req.body.taskId, req.body.calculateFilename);

        let jobdata = {
            wrapper : codetest,
            answer : answerPath,
            file : answerPath,
            code : codePath,
            task : req.body.taskId
        }
        console.log(jobdata);
        const result = await addJob(jobdata);
        if( result == 0) {
            res.status(200).send({"ct" : 0, "result":"success"});
        }else {
            res.status(200).send({"ct" : 1, "result":"Exceeding the maximum number"});
        }
    } catch(ex) {
        res.status(200).send({"ct" : 1, "result":"failed"}); 
    }
});

client
.connect()
.then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}.`);
    });
})
.catch((err:any) => console.error('connection error', err.stack))






