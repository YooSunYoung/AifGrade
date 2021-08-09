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
import moment from 'moment';

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
            let targetfile: string = path.join(String(job.data.file), 'answer.csv');
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
                    text: 'UPDATE T_CALCULATE_SET SET VERIFY_STATUS = $1, VERIFY_ERR_MSG = $2 WHERE TASK_ID = $3',
                    values: ["success", String(pbScore), parseInt(job.data.task)]
                };
                const resultquery = await client.query(query);
            } else {
                let newpath: string = path.join(String(process.env.ERROR_DIR), path.basename(job.data.jobPath));
                await fs.rename(job.data.jobPath, newpath);
                const queryerror = {
                    text: 'UPDATE T_CALCULATE_SET SET VERIFY_STATUS = $1, VERIFY_ERR_MSG = $2 WHERE TASK_ID = $3',
                    values: ['fail', errMessage, parseInt(job.data.task)]
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
                    text: 'UPDATE T_LAP_ADHRNC SET SCRE = $1, FILE_NM = $2, ERR_MESSAGE = $3 WHERE ADHRNC_SN = $4',
                    values: [pbScore, path.basename(job.data.file), errMessage, String(job.data.snFirst)]
                };
                const resultquery = await client.query(query);
                if( resultfilter.length > 1) {
                    const querypr = {
                        text: 'UPDATE T_LAP_ADHRNC SET SCRE = $1, FILE_NM = $2, ERR_MESSAGE = $3 WHERE ADHRNC_SN = $4',
                        values: [prScore, path.basename(job.data.file), errMessage, String(job.data.snSecond)]
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
                    text: 'UPDATE T_LAP_ADHRNC SET SCRE = $1, FILE_NM = $2, ERR_MESSAGE = $3 WHERE ADHRNC_SN = $4',
                    values: [null, path.basename(job.data.file), errMessage, String(job.data.snFirst)]
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

const checkDayLimit = async (limit: any, dbc:Client, ct: moment.Moment, taskid: string, userid: string) => {
    let localstr :string = ct.format("yyyy-MM-DD") + " 00:00:00";
    let st = moment(localstr, "yyyy-MM-DD HH:mm:ss");
    let et = moment(st).clone().add(Number(limit.daylimit.day), 'days');

    let utcst = st.utc();
    let utcet = et.utc();

    let utcststr = utcst.format('yyyy-MM-DD HH:mm:ss');
    let utcetstr = utcet.format('yyyy-MM-DD HH:mm:ss');
    const dayquery = {
        text: "SELECT count(*) FROM t_lap_adhrnc where task_id = $1 and user_id = $2 and result_sbmisn_mthd_code = '0000' and SCRE is not null and err_message = '' and regist_dttm BETWEEN $3 AND $4",
        values: [taskid, userid, utcststr, utcetstr]
    };
    const results = await client.query(dayquery);
    if( Number(results.rows[0].count) > Number(limit.daylimit.count)){
        return 1;
    }
    return 0;
};

const checkResubmit = async (limit: any, dbc:Client, ct: moment.Moment, taskid: string, userid: string) => {
    const lastquery = {
        text: "SELECT regist_dttm FROM t_lap_adhrnc where task_id = $1 and user_id = $2 and result_sbmisn_mthd_code = '0000' and SCRE is not null and err_message = '' ORDER BY adhrnc_sn DESC LIMIT 1",
        values: [taskid, userid]
    };
    const lastresults = await client.query(lastquery);
    let registstr: string = lastresults.rows[0].regist_dttm;
    let refdt = moment(registstr, "yyyy-MM-DD HH:mm:ss");
    let nowutcdt = moment(ct.utc().format("yyyy-MM-DD HH:mm:ss"), "yyyy-MM-DD HH:mm:ss");
    let diff = moment.duration(nowutcdt.diff(refdt)).asMinutes();
    if( diff < Number(limit.resubmit.min)){
        return 2;
    }
    return 0;
};

const checkRule = async (limit: any, dbc:Client, ct: moment.Moment, taskid: string, userid: string) => {
    let localtime = ct;
    let ret: number = 0;
    switch( limit.type) {
        case 0:
            break;
        case 1: 
            ret = await checkDayLimit(limit, dbc, localtime, taskid, userid);
            break;
        case 2: 
            ret = await checkResubmit(limit, dbc, localtime, taskid, userid);
            break;
        case 3: 
            ret = await checkDayLimit(limit, dbc, localtime, taskid, userid);
            if( ret > 0) return ret;
            ret = await checkResubmit(limit, dbc, localtime, taskid, userid);
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
            text: 'SELECT task_id FROM t_partcpt_agre WHERE key_value = $1',
            values: [req.body.key]
        };
        const results = await client.query(paquery);
        if( results.rows.length == 0){
            return res.status(400).send("non-existent key");
        }

        let taskid: string = results.rows[0].task_id;
        let answer: string = "answer";
        let code: string = "code.py";
        
        let answerPath: string = path.join(String(process.env.TASK_ROOT), taskid, answer);
        let codePath: string = path.join(String(process.env.TASK_ROOT), taskid, code);
        let jobPath: string = path.join(String(process.env.JOB_DIR), path.basename(req.file.path + ".json"));
        let jobdata = {
            answer : answerPath,
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
            text: 'SELECT task_id, user_id FROM t_partcpt_agre WHERE key_value = $1',
            values: [req.body.key]
        };
        const results = await client.query(paquery);
        if( results.rows.length == 0){
            return res.status(400).send("non-existent key");
        }
        let dt = new Date();
        let ct = moment(dt);
        let taskid: string = results.rows[0].task_id;
        let userid: string = results.rows[0].user_id;

        const taskquery = {
            text: 'SELECT begin_dttm, end_dttm, submit_limit FROM t_task WHERE task_id = $1',
            values: [taskid]
        };
        const resulttask = await client.query(taskquery);
        if( resulttask.rows.length == 0){
            return res.status(400).send("non-existent taskid");
        }

        let begindt: Date = new Date(resulttask.rows[0].begin_dttm);
        let enddt: Date = new Date(resulttask.rows[0].end_dttm);
        let submitLmit: any = JSON.parse(resulttask.rows[0].submit_limit);
        if( dt > enddt){
            return res.status(400).send("submission timeout");
        }

        let ret: number = await checkRule(submitLmit, client, ct, taskid, userid);
        if( ret > 0) {
            return res.status(400).send("violation of the rules:" + ret);
        }
        
        const queryfirst = {
            text: 'INSERT INTO T_LAP_ADHRNC (TASK_ID, LAP_SN, ADHRNC_SE_CODE, USER_ID, MODEL_NM, RESULT_SBMISN_MTHD_CODE, REGISTER_ID) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING adhrnc_sn',
            values: [taskid, 1, '0000', userid, req.body.model, '0000', userid]
        };

        const resultfirst = await client.query(queryfirst);
        let snFirst: number = resultfirst.rows[0].adhrnc_sn;

        const querysecond = {
            text: 'INSERT INTO T_LAP_ADHRNC (TASK_ID, LAP_SN, ADHRNC_SE_CODE, USER_ID, MODEL_NM, RESULT_SBMISN_MTHD_CODE, REGISTER_ID) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING adhrnc_sn',
            values: [taskid, 1, '0001', userid, req.body.model, '0001', userid]
        };

        const resultsecond = await client.query(querysecond);
        let snSecond: number = resultsecond.rows[0].adhrnc_sn;

        let answer: string = "answer";
        let code: string = "code.py";
        
        let answerPath: string = path.join(String(process.env.TASK_ROOT), taskid, answer);
        let codePath: string = path.join(String(process.env.TASK_ROOT), taskid, code);
        let jobPath: string = path.join(String(process.env.JOB_DIR), path.basename(req.file.path + ".json"));
        let jobdata = {
            answer : answerPath,
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
        let dt = new Date();
        let ct = moment(dt);
        let submissionTime = dt.toISOString().replace("T", " ").replace("Z", "");
        const paquery = {
            text: 'SELECT task_id, user_id FROM t_partcpt_agre WHERE key_value = $1',
            values: [req.body.key]
        };
        const results = await client.query(paquery);
        if( results.rows.length == 0){
            return res.status(400).send("non-existent key");
        }
        let taskid: string = results.rows[0].task_id;
        let userid: string = results.rows[0].user_id;

        const taskquery = {
            text: 'SELECT begin_dttm, end_dttm, submit_limit FROM t_task WHERE task_id = $1',
            values: [taskid]
        };
        const resulttask = await client.query(taskquery);
        if( resulttask.rows.length == 0){
            return res.status(400).send("non-existent taskid");
        }

        let begindt: Date = new Date(resulttask.rows[0].begin_dttm);
        let enddt: Date = new Date(resulttask.rows[0].end_dttm);
        let submitLmit: any = JSON.parse(resulttask.rows[0].submit_limit);
        if( dt > enddt){
            return res.status(400).send("submission timeout");
        }

        let ret: number = await checkRule(submitLmit, client, ct, taskid, userid);
        if( ret > 0) {
            return res.status(400).send("violation of the rules:" + ret);
        }

        const queryfirst = {
            text: 'INSERT INTO T_LAP_ADHRNC (TASK_ID, LAP_SN, ADHRNC_SE_CODE, USER_ID, RESULT_SBMISN_MTHD_CODE, REGISTER_ID, REGIST_DTTM) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING adhrnc_sn',
            values: [taskid, 1, '0000', userid, '0000', userid, submissionTime]
        };

        const resultfirst = await client.query(queryfirst);
        let snFirst: number = resultfirst.rows[0].adhrnc_sn;

        const querySecond = {
            text: 'INSERT INTO T_LAP_ADHRNC (TASK_ID, LAP_SN, ADHRNC_SE_CODE, USER_ID, RESULT_SBMISN_MTHD_CODE, REGISTER_ID, REGIST_DTTM) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING adhrnc_sn',
            values: [taskid, 1, '0001', userid, '0001', userid, submissionTime]
        };

        const resultsecond = await client.query(querySecond);
        let snSecond: number = resultsecond.rows[0].adhrnc_sn;

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
            text: 'SELECT task_id, user_id FROM t_partcpt_agre WHERE key_value = $1',
            values: [req.body.key]
        };
        const results = await client.query(paquery);
        if( results.rows.length == 0){
            return res.status(400).send("non-existent key");
        }
        let taskid: string = results.rows[0].task_id;
        let userid: string = results.rows[0].user_id;

        const queryfirst = {
            text: 'SELECT adhrnc_sn FROM t_lap_adhrnc WHERE task_id = $1 and user_id = $2 and adhrnc_se_code = $3 ORDER BY adhrnc_sn DESC LIMIT 1',
            values: [taskid, userid, '0000']
        };

        const resultfirst = await client.query(queryfirst);
        let snFirst: number = resultfirst.rows[0].adhrnc_sn;

        const querySecond = {
            text: 'SELECT adhrnc_sn FROM t_lap_adhrnc WHERE task_id = $1 and user_id = $2 and adhrnc_se_code = $3 ORDER BY adhrnc_sn DESC LIMIT 1',
            values: [taskid, userid, '0001']
        };

        const resultsecond = await client.query(querySecond);
        let snSecond: number = resultsecond.rows[0].adhrnc_sn;

        

        if( req.body.error != "none") {
            //let errojson : any = { type: 1, message : req.body.error};
            //let errjosnstr = JSON.stringify(errojson);
            const queryerror = {
                text: 'UPDATE T_LAP_ADHRNC SET SCRE = $1, ERR_MESSAGE = $2 WHERE ADHRNC_SN = $3',
                values: [null, "", snFirst]
            };
            const resultquerypr = await client.query(queryerror);
            return res.status(200).send("success");
        }else{
            
            if (req.file == undefined) {
                return res.status(400).send("file upload error");
            }
            let answer: string = "answer";
            let code: string = "code.py";
            
            let answerPath: string = path.join(String(process.env.TASK_ROOT), taskid, answer);
            let codePath: string = path.join(String(process.env.TASK_ROOT), taskid, code);
            let jobPath: string = path.join(String(process.env.JOB_DIR), path.basename(req.file.path + ".json"));
            let jobdata = {
                answer : answerPath,
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
        
        let answerPath: string = path.join(String(process.env.TASK_ROOT), String(req.body.taskId), answer);
        let codePath: string = path.join(String(process.env.TASK_ROOT), String(req.body.taskId), code);
        let jobdata = {
            answer : answerPath,
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






