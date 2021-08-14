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
import upload from "./multerUtilUpload";
import Queue from 'bull'; 
import { doesNotMatch } from "assert/strict";
import os from 'os';
import moment from "moment-timezone";
//import moment from 'moment';

const extractzip = require('extract-zip');
const spawn = require('await-spawn');
var randomstring = require("randomstring");

const PORT = process.env.PORT;
const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    host: process.env.DB_HOST,
    port: parseInt(String(process.env.DB_PORT)),
    database: process.env.DB_NAME
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
    let pythonexe : string = String(process.env.PYTHON_EXE);
    let returnResult: any;
    let errMessage: string = "";
    let pbScore:number = 0;
    let prScore:number = 0;
    let resultfilter: string[] = [];

    if( String(job.data.snFirst) == "code_test") {
        try{
            let targetfile: string = job.data.answer;//path.join(String(job.data.file), 'answer.csv');
            returnResult = await spawn(pythonexe, [job.data.code, job.data.answer, targetfile]);
        } catch(ex) {
            errMessage = ex.stderr.toString();
        }
        try
        {
            if( errMessage == ""){
                let result:string = returnResult.toString();
                var lines = result.split(os.EOL);
                resultfilter = lines.filter(line => line.includes('score:'));
                const splits = resultfilter[0].split(':');
                pbScore = parseFloat(splits[1]);
                
                if( isNaN(pbScore) ) {
                    errMessage = 'Error: nan returned as score';
                }

                if( resultfilter.length > 1) {
                    const splitssec = resultfilter[1].split(':');
                    prScore = parseFloat(splitssec[1]);
                    if( isNaN(prScore) ) {
                        errMessage = 'Error: nan returned as score';
                    }
                }
            }
            if( errMessage == '')
            {
                const query = {
                    text: 'UPDATE code_test_result SET status = $1, error = $2 WHERE task_id = $3',
                    values: [0, String(pbScore), parseInt(job.data.task)]
                };
                const resultquery = await client.query(query);
            } else {
                let newpath: string = path.join(String(process.env.ERROR_DIR), path.basename(job.data.jobPath));
                await fs.rename(job.data.jobPath, newpath);
                const queryerror = {
                    text: 'UPDATE code_test_result SET status = $1, error = $2 WHERE task_id = $3',
                    values: [1, errMessage, parseInt(job.data.task)]
                };
                const resultquerypr = await client.query(queryerror);
            }
            done(null, "END");
        } catch(ex) {
            done(ex.stderr.toString(), null);
        }
    } else {
        try{
            returnResult = await spawn(pythonexe, [job.data.code, job.data.answer, job.data.file]);
        } catch(ex) {
            errMessage = ex.stderr.toString();
        }

        try {
            if( errMessage == ""){
                let result:string = returnResult.toString();
                var lines = result.split(os.EOL);
                resultfilter = lines.filter(line => line.includes('score:'));
                const splits = resultfilter[0].split(':');
                pbScore = parseFloat(splits[1]);
                
                if( isNaN(pbScore) ) {
                    errMessage = 'Error: nan returned as score';
                }

                if( resultfilter.length > 1) {
                    const splitssec = resultfilter[1].split(':');
                    prScore = parseFloat(splitssec[1]);
                    if( isNaN(prScore) ) {
                        errMessage = 'Error: nan returned as score';
                    }
                }
            }
            //let errojson : any = { type: 0, message : ""};
            //let errjosnstr = JSON.stringify(errojson);

            if( errMessage == '')
            {
                const query = {
                    text: 'UPDATE task_submission SET score = $1, file = $2, error = $3 WHERE id = $4',
                    values: [pbScore, path.basename(job.data.file), errMessage, Number(job.data.snFirst)]
                };
                const resultquery = await client.query(query);
                if( resultfilter.length > 1) {
                    const querypr = {
                        text: 'UPDATE task_submission SET score = $1, file = $2, error = $3 WHERE id = $4',
                        values: [prScore, path.basename(job.data.file), errMessage, Number(job.data.snSecond)]
                    };
                    const resultquerypr = await client.query(querypr);
                }
                await fs.unlink(job.data.jobPath);
            } else {
                //errojson.type = 2;
                //errojson.message = errMessage;
                //errjosnstr = JSON.stringify(errojson);

                let newpath: string = path.join(String(process.env.ERROR_DIR), path.basename(job.data.jobPath));
                await fs.rename(job.data.jobPath, newpath);
                const queryerror = {
                    text: 'UPDATE task_submission SET score = $1, file = $2, error = $3 WHERE id = $4',
                    values: [null, path.basename(job.data.file), errMessage, Number(job.data.snFirst)]
                };
                const resultquerypr = await client.query(queryerror);
            }
            done(null, "END");
        } catch(ex) {
            done(ex.stderr.toString(), null);
        }
    }
    
});

gqueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed with result ${result}`);

})

gqueue.on('failed', (job, result) => {
    console.log(`Job ${job.id} failed with result ${result}`);
})

const checkDayLimit = async (rules: any, dbc:Client, ct: moment.Moment, taskid: number, userid: string) => {
    //console.log("ct:" + ct.format('yyyy-MM-DD HH:mm:ss'));
    let localct = ct.clone().tz("Asia/Seoul");
    console.log("localct:" + localct.format("yyyy-MM-DD HH:mm:ss"))
    let localstr :string = localct.format("yyyy-MM-DD") + " 00:00:00";

    console.log("localstr:" + localstr)
    let st = moment(localstr, "yyyy-MM-DD HH:mm:ss");
    let et = moment(st).clone().add(Number(rules.daylimit.day), 'days');

    let utcst = st.utc();
    let utcet = et.utc();

    let utcststr = utcst.format('yyyy-MM-DD HH:mm:ss');
    let utcetstr = utcet.format('yyyy-MM-DD HH:mm:ss');

    console.log("utcststr:" + utcststr);
    console.log("utcetstr:" + utcetstr);
    const dayquery = {
        text: "SELECT count(*) FROM task_submission where task_id = $1 and user_id = $2 and method_code = 0 and score is not null and error = '' and registration_date BETWEEN $3 AND $4",
        values: [taskid, userid, utcststr, utcetstr]
    };
    const results = await client.query(dayquery);
    if( Number(results.rows[0].count) > Number(rules.daylimit.count)){
        return 1;
    }
    return 0;
};

const checkResubmit = async (rules: any, dbc:Client, ct: moment.Moment, taskid: number, userid: string) => {
    const lastquery = {
        text: "SELECT registration_date FROM task_submission where task_id = $1 and user_id = $2 and method_code = 0 and score is not null and error = '' ORDER BY id DESC LIMIT 1",
        values: [taskid, userid]
    };
    const lastresults = await client.query(lastquery);
    let refdt = moment(lastresults.rows[0].registration_date).utc();
    console.log("ct:" + ct.format("yyyy-MM-DD HH:mm:ss"));
    console.log("refdt:" + refdt.format("yyyy-MM-DD HH:mm:ss"));
    let diff = moment.duration(ct.diff(refdt)).asMinutes();
    if( diff < Number(rules.resubmit.min)){
        return 2;
    }
    return 0;
};

const checkRule = async (rules: any, dbc:Client, ct: moment.Moment, taskid: number, userid: string) => {
    //let localtime = ct;
    let ret: number = 0;
    switch( rules.type) {
        case 0:
            break;
        case 1: 
            ret = await checkDayLimit(rules, dbc, ct, taskid, userid);
            break;
        case 2: 
            ret = await checkResubmit(rules, dbc, ct, taskid, userid);
            break;
        case 3: 
            ret = await checkDayLimit(rules, dbc, ct, taskid, userid);
            if( ret > 0) return ret;
            ret = await checkResubmit(rules, dbc, ct, taskid, userid);
            break;
        default:
            break;
    }

    return ret;
};

async function addJob(data: any): Promise<number> {
    await gqueue.add(data);
    return 0;
}

const app: Application = express();
app.use(express.json());
app.use(cors());
app.use(morgan("tiny"));

app.post("/grading", async (req, res) => {
    try {
        await uploadFile(req, res);
        if (req.file == undefined) {
            return res.status(400).send("file upload error");
        }
        console.log(req.file);

        const paquery = {
            text: 'SELECT task_id FROM task_user WHERE key = $1',
            values: [req.body.key]
        };
        const results = await client.query(paquery);
        if( results.rows.length == 0){
            return res.status(400).send("non-existent key");
        }

        let taskid: number = results.rows[0].task_id;
        let answer: string = "answer";
        let code: string = "code.py";
        
        let taskpath: string = path.join(String(process.env.TASK_ROOT), taskid.toString());
        let answerfile:string;
        let answerPath: string = path.join(taskpath, answer);
        let files = await fs.readdir(answerPath);
        if( files.length > 1){
            answerfile = answerPath; // zip
        }else if(files.length == 1){
            answerfile = path.join(answerPath,files[0]); // single file 
        }
        else{
            return res.status(400).send("no answer file");
        }

        let codePath: string = path.join(taskpath, code);
        let jobPath: string = path.join(String(process.env.JOB_DIR), path.basename(req.file.path + ".json"));
        let jobdata = {
            answer : answerfile,
            file : req.file.path,
            code : codePath,
            task : taskid,
            snFirst : req.body.snFirst,
            snSecond : req.body.snSecond,
            jobPath : jobPath
        }
        var json = JSON.stringify(jobdata);
        await fs.writeFile(jobPath, json, 'utf8');

        const result = await addJob(jobdata);
        if( result == 0) {
            res.status(200).send("success");
        }else{
            res.status(400).send("job error");
        }
    } catch (ex) {
        res.status(400).send(ex.message);
    }
});

app.post("/submit", async (req, res) => {
    
    try{
        await uploadFile(req, res);
        if (req.file == undefined) {
            return res.status(400).send("file upload error");
        }
        const paquery = {
            text: 'SELECT task_id, user_id FROM task_user WHERE key = $1',
            values: [req.body.key]
        };
        const results = await client.query(paquery);
        if( results.rows.length == 0){
            return res.status(400).send("non-existent key");
        }
        //let dt = new Date();
        //let ct = moment(dt);
        let ct = moment().utc();
        let taskid: number = results.rows[0].task_id;
        let userid: string = results.rows[0].user_id;

        const taskquery = {
            text: 'SELECT start_date, end_date, rules FROM task WHERE id = $1',
            values: [taskid]
        };
        const resulttask = await client.query(taskquery);
        if( resulttask.rows.length == 0){
            return res.status(400).send("non-existent taskid");
        }

        let startdt: Date = resulttask.rows[0].start_date;
        //let enddt: Date = resulttask.rows[0].end_date;
        let enddt = moment(resulttask.rows[0].end_date).utc();
        let rules: any = JSON.parse(resulttask.rows[0].rules);
        if( ct > enddt){
            return res.status(400).send("submission timeout");
        }

        let ret: number = await checkRule(rules, client, ct, taskid, userid);
        if( ret > 0) {
            return res.status(400).send("violation of the rules:" + ret);
        }
        
        const queryfirst = {
            text: 'INSERT INTO task_submission (task_id, lap, se_code, user_id, model_name, method_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            values: [taskid, 1, 0, userid, req.body.model, 0]
        };

        const resultfirst = await client.query(queryfirst);
        let snFirst: number = resultfirst.rows[0].id;

        const querysecond = {
            text: 'INSERT INTO task_submission (task_id, lap, se_code, user_id, model_name, method_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            values: [taskid, 1, 1, userid, req.body.model, 1]
        };

        const resultsecond = await client.query(querysecond);
        let snSecond: number = resultsecond.rows[0].id;

        let answer: string = "answer";
        let code: string = "code.py";
        let taskpath: string = path.join(String(process.env.TASK_ROOT), taskid.toString());
        let answerfile:string;
        let answerPath: string = path.join(taskpath, answer);
        let files = await fs.readdir(answerPath);
        if( files.length > 1){
            answerfile = answerPath; // zip
        }else if(files.length == 1){
            answerfile = path.join(answerPath,files[0]); // single file 
        }
        else{
            return res.status(400).send("no answer file");
        }

        let codePath: string = path.join(taskpath, code);
        let jobPath: string = path.join(String(process.env.JOB_DIR), path.basename(req.file.path + ".json"));
        let jobdata = {
            answer : answerfile,
            file : req.file.path,
            code : codePath,
            task : taskid,
            snFirst : snFirst,
            snSecond : snSecond,
            jobPath : jobPath
        }
        var json = JSON.stringify(jobdata);
        await fs.writeFile(jobPath, json, 'utf8');
        const result = await addJob(jobdata);
        if( result == 0) {
            res.status(200).send("success");
        }else{
            res.status(400).send("job error");
        }
    } catch(ex) {
        res.status(400).send(ex.message); 
    }
});

app.post("/submissionTime", async (req, res) => {
    try{
        let ct = moment().utc();
        console.log("ct:" + ct.format("yyyy-MM-DD HH:mm:ss"));
        const paquery = {
            text: 'SELECT task_id, user_id FROM task_user WHERE key = $1',
            values: [req.body.key]
        };
        const results = await client.query(paquery);
        if( results.rows.length == 0){
            return res.status(400).send("non-existent key");
        }
        let taskid: number = results.rows[0].task_id;
        let userid: string = results.rows[0].user_id;

        const taskquery = {
            text: 'SELECT start_date, end_date, rules FROM task WHERE id = $1',
            values: [taskid]
        };
        const resulttask = await client.query(taskquery);
        if( resulttask.rows.length == 0){
            return res.status(400).send("non-existent taskid");
        }
        console.log(resulttask.rows[0].start_date);
        console.log(resulttask.rows[0].end_date);

        let startdt: Date = resulttask.rows[0].start_date;
        let enddt = moment(resulttask.rows[0].end_date).utc();

        console.log(startdt);
        console.log(enddt);
        let rules: any = JSON.parse(resulttask.rows[0].rules);
        if( ct > enddt){
            return res.status(400).send("submission timeout");
        }

        let ret: number = await checkRule(rules, client, ct, taskid, userid);
        if( ret > 0) {
            let reterror: string = "error";
            switch( ret ){
                case 1:
                    reterror = "You have exceeded the number of submissions in the specified period";
                    break;
                case 2:
                    reterror = "Submission interval time exceeded";
                    break;
                case 3:
                    reterror = "violation of rules";
                    break;
                default:
                    break;
            }

            return res.status(400).send(reterror);
        }

        const queryfirst = {
            text: 'INSERT INTO task_submission (task_id, lap, se_code, user_id, method_code) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            values: [taskid, 1, 0, userid, 0]
        };

        const resultfirst = await client.query(queryfirst);
        let snFirst: number = resultfirst.rows[0].id;

        const querySecond = {
            text: 'INSERT INTO task_submission (task_id, lap, se_code, user_id, method_code) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            values: [taskid, 1,  1, userid, 1]
        };

        const resultsecond = await client.query(querySecond);
        let snSecond: number = resultsecond.rows[0].id;

        res.status(200).send("success");
    }catch(ex) {
        console.log("step error");
        res.status(400).send(ex.message); 
    }
});

app.post("/submitEx", async (req, res) => {
    try{

        await uploadFile(req, res);
        console.log(req.body);
                
        const paquery = {
            text: 'SELECT task_id, user_id FROM task_user WHERE key = $1',
            values: [req.body.key]
        };
        const results = await client.query(paquery);
        if( results.rows.length == 0){
            return res.status(400).send("non-existent key");
        }
        let taskid: number = results.rows[0].task_id;
        let userid: string = results.rows[0].user_id;

        const queryfirst = {
            text: 'SELECT id FROM task_submission WHERE task_id = $1 and user_id = $2 and se_code = $3 ORDER BY id DESC LIMIT 1',
            values: [taskid, userid, 0]
        };

        const resultfirst = await client.query(queryfirst);
        let snFirst: number = resultfirst.rows[0].id;

        const querySecond = {
            text: 'SELECT id FROM task_submission WHERE task_id = $1 and user_id = $2 and se_code = $3 ORDER BY id DESC LIMIT 1',
            values: [taskid, userid, 1]
        };

        const resultsecond = await client.query(querySecond);
        let snSecond: number = resultsecond.rows[0].id;
   
        if( req.body.error != "none") {
            const queryerror = {
                text: 'UPDATE task_submission SET score = $1, error = $2 WHERE id = $3',
                values: [null, req.body.error, snFirst]
            };
            const resultquerypr = await client.query(queryerror);
            return res.status(200).send("success");
        }else{
            
            if (req.file == undefined) {
                return res.status(400).send("file upload error");
            }
            
            let answer: string = "answer";
            let code: string = "code.py";
            let taskpath: string = path.join(String(process.env.TASK_ROOT), taskid.toString());
            let answerfile:string;
            let answerPath: string = path.join(taskpath, answer);
            let files = await fs.readdir(answerPath);
            if( files.length > 1){
                answerfile = answerPath; // zip
            }else if(files.length == 1){
                answerfile = path.join(answerPath,files[0]); // single file 
            }
            else{
                return res.status(400).send("no answer file");
            }

            let codePath: string = path.join(taskpath, code);
            let jobPath: string = path.join(String(process.env.JOB_DIR), path.basename(req.file.path + ".json"));
            let jobdata = {
                answer : answerfile,
                file : req.file.path,
                code : codePath,
                task : taskid,
                snFirst : snFirst,
                snSecond : snSecond,
                jobPath : jobPath
            }
            var json = JSON.stringify(jobdata);
            await fs.writeFile(jobPath, json, 'utf8');
            console.log(jobdata);

            const result = await addJob(jobdata);
            if( result == 0) {
                res.status(200).send("success");
            }else{
                res.status(400).send("job error");
            }       
        } 
    }catch(ex) {
        res.status(400).send(ex.message); 
    }
});

app.post("/test", async (req, res) => {
    try{
        let answer: string = "answer";
        let code: string = "code.py";
        let taskpath: string = path.join(String(process.env.TASK_ROOT), req.body.taskId.toString());
        let answerfile:string;
        let answerPath: string = path.join(taskpath, answer);
        let files = await fs.readdir(answerPath);
        if( files.length > 1){
            answerfile = answerPath; // zip
        }else if(files.length == 1){
            answerfile = path.join(answerPath,files[0]); // single file 
        }
        else{
            return res.status(400).send("no answer file");
        }

        let codePath: string = path.join(taskpath, code);
        let jobdata = {
            answer : answerfile,
            code : codePath,
            file : answerPath,
            task : req.body.taskId,
            snFirst: "code_test",
        }
        const result = await addJob(jobdata);
        if( result == 0) {
            res.status(200).send("success");
        }else {
            res.status(400).send("job error");
        }
    } catch(ex) {
        res.status(400).send(ex.message); 
    }
});

app.post("/uploadCode", async (req, res) => {
    try{
        await upload(req, res);
        if (req.file == undefined) {
            return res.status(400).send("file upload error");
        }
        let dir = path.join(String(process.env.TASK_ROOT), String(req.body.taskId));
        if( !fssync.existsSync(dir)) {
            await fs.mkdir(dir);
        }
        let newpath: string = path.join(dir, 'code.py');
        await fs.rename(req.file.path, newpath);
        res.status(200).send("success");
    } catch(ex) {
        res.status(400).send(ex.message); 
    }
});

app.post("/uploadAnswer", async (req, res) => {
    try{
        await upload(req, res);
        if (req.file == undefined) {
            return res.status(400).send("file upload error");
        }
        let dir = path.join(String(process.env.TASK_ROOT), String(req.body.taskId), 'answer');
        if( !fssync.existsSync(dir)) {
            await fs.mkdir(dir, { recursive: true });
        }
        else{
            // rm -rf /path/to/directory/*
            const files = await fs.readdir(dir);
            for (const file of files) {
                await fs.unlink(path.join(dir, file));
            }
        }
        let ext:string = path.extname(req.file.path);
        let newfilename:string = "answer" + ext;
        let newpath: string = path.join(dir, newfilename);
        await fs.rename(req.file.path, newpath);
        if(ext == '.zip') {
            await extractzip(newpath, { dir: dir });
            await fs.unlink(newpath);
        }
        res.status(200).send("success");
    } catch(ex) {
        res.status(400).send(ex.message); 
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






