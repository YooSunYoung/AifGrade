"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
var express_1 = __importDefault(require("express"));
var path_1 = __importDefault(require("path"));
var promises_1 = __importDefault(require("fs/promises"));
var fs_1 = __importDefault(require("fs"));
var morgan_1 = __importDefault(require("morgan"));
var cors = require('cors');
var pg_1 = require("pg");
var multerUtil_1 = __importDefault(require("./multerUtil"));
var multerUtilUpload_1 = __importDefault(require("./multerUtilUpload"));
var bull_1 = __importDefault(require("bull"));
var os_1 = __importDefault(require("os"));
var extractzip = require('extract-zip');
var spawn = require('await-spawn');
var randomstring = require("randomstring");
var PORT = process.env.PORT;
var client = new pg_1.Client({
    user: process.env.USER,
    password: process.env.PWD,
    host: process.env.HOST,
    port: parseInt(String(process.env.DB_PORT)),
    database: process.env.DB
});
var gqueue = new bull_1.default('gradeQueue', {
    limiter: {
        max: parseInt(String(process.env.QUEUE_MAX)),
        duration: parseInt(String(process.env.QUEUE_DURATION))
    },
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
    },
});
gqueue.process(function (job, done) { return __awaiter(void 0, void 0, void 0, function () {
    var returnResult, errMessage, pbScore, prScore, resultfilter, targetfile, ex_1, result, lines, splits, splitssec, query, resultquery, newpath, queryerror, resultquerypr, ex_2, ex_3, result, lines, splits, splitssec, query, resultquery, querypr, resultquerypr, newpath, queryerror, resultquerypr, ex_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                errMessage = "";
                pbScore = 0;
                prScore = 0;
                resultfilter = [];
                if (!(String(job.data.snFirst) == "code_test")) return [3 /*break*/, 12];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                targetfile = path_1.default.join(String(job.data.file), 'answer.csv');
                return [4 /*yield*/, spawn('python', [job.data.code, job.data.answer, targetfile])];
            case 2:
                returnResult = _a.sent();
                return [3 /*break*/, 4];
            case 3:
                ex_1 = _a.sent();
                errMessage = ex_1.stderr.toString();
                return [3 /*break*/, 4];
            case 4:
                _a.trys.push([4, 10, , 11]);
                if (errMessage == "") {
                    result = returnResult.toString();
                    lines = result.split(os_1.default.EOL);
                    resultfilter = lines.filter(function (line) { return line.includes('score:'); });
                    splits = resultfilter[0].split(':');
                    pbScore = parseFloat(splits[1]);
                    if (isNaN(pbScore)) {
                        errMessage = 'Error: nan returned as score';
                    }
                    if (resultfilter.length > 1) {
                        splitssec = resultfilter[1].split(':');
                        prScore = parseFloat(splitssec[1]);
                        if (isNaN(prScore)) {
                            errMessage = 'Error: nan returned as score';
                        }
                    }
                }
                if (!(errMessage == '')) return [3 /*break*/, 6];
                query = {
                    text: 'UPDATE T_CALCULATE_SET SET VERIFY_STATUS = $1, VERIFY_ERR_MSG = $2 WHERE TASK_ID = $3',
                    values: ["success", String(pbScore), parseInt(job.data.task)]
                };
                return [4 /*yield*/, client.query(query)];
            case 5:
                resultquery = _a.sent();
                return [3 /*break*/, 9];
            case 6:
                newpath = path_1.default.join(String(process.env.ERROR_DIR), path_1.default.basename(job.data.jobPath));
                return [4 /*yield*/, promises_1.default.rename(job.data.jobPath, newpath)];
            case 7:
                _a.sent();
                queryerror = {
                    text: 'UPDATE T_CALCULATE_SET SET VERIFY_STATUS = $1, VERIFY_ERR_MSG = $2 WHERE TASK_ID = $3',
                    values: ['fail', errMessage, parseInt(job.data.task)]
                };
                return [4 /*yield*/, client.query(queryerror)];
            case 8:
                resultquerypr = _a.sent();
                _a.label = 9;
            case 9:
                done(null, "END");
                return [3 /*break*/, 11];
            case 10:
                ex_2 = _a.sent();
                done(ex_2.stderr.toString(), null);
                return [3 /*break*/, 11];
            case 11: return [3 /*break*/, 25];
            case 12:
                _a.trys.push([12, 14, , 15]);
                return [4 /*yield*/, spawn('python', [job.data.code, job.data.answer, job.data.file])];
            case 13:
                returnResult = _a.sent();
                return [3 /*break*/, 15];
            case 14:
                ex_3 = _a.sent();
                errMessage = ex_3.stderr.toString();
                return [3 /*break*/, 15];
            case 15:
                _a.trys.push([15, 24, , 25]);
                if (errMessage == "") {
                    result = returnResult.toString();
                    lines = result.split(os_1.default.EOL);
                    resultfilter = lines.filter(function (line) { return line.includes('score:'); });
                    splits = resultfilter[0].split(':');
                    pbScore = parseFloat(splits[1]);
                    if (isNaN(pbScore)) {
                        errMessage = 'Error: nan returned as score';
                    }
                    if (resultfilter.length > 1) {
                        splitssec = resultfilter[1].split(':');
                        prScore = parseFloat(splitssec[1]);
                        if (isNaN(prScore)) {
                            errMessage = 'Error: nan returned as score';
                        }
                    }
                }
                if (!(errMessage == '')) return [3 /*break*/, 20];
                query = {
                    text: 'UPDATE T_LAP_ADHRNC SET SCRE = $1, FILE_NM = $2, ERR_MESSAGE = $3 WHERE ADHRNC_SN = $4',
                    values: [pbScore, path_1.default.basename(job.data.file), null, String(job.data.snFirst)]
                };
                return [4 /*yield*/, client.query(query)];
            case 16:
                resultquery = _a.sent();
                if (!(resultfilter.length > 1)) return [3 /*break*/, 18];
                querypr = {
                    text: 'UPDATE T_LAP_ADHRNC SET SCRE = $1, FILE_NM = $2, ERR_MESSAGE = $3 WHERE ADHRNC_SN = $4',
                    values: [prScore, path_1.default.basename(job.data.file), null, String(job.data.snSecond)]
                };
                return [4 /*yield*/, client.query(querypr)];
            case 17:
                resultquerypr = _a.sent();
                _a.label = 18;
            case 18: return [4 /*yield*/, promises_1.default.unlink(job.data.jobPath)];
            case 19:
                _a.sent();
                return [3 /*break*/, 23];
            case 20:
                newpath = path_1.default.join(String(process.env.ERROR_DIR), path_1.default.basename(job.data.jobPath));
                return [4 /*yield*/, promises_1.default.rename(job.data.jobPath, newpath)];
            case 21:
                _a.sent();
                queryerror = {
                    text: 'UPDATE T_LAP_ADHRNC SET SCRE = $1, FILE_NM = $2, ERR_MESSAGE = $3 WHERE ADHRNC_SN = $4',
                    values: [null, path_1.default.basename(job.data.file), errMessage, String(job.data.snFirst)]
                };
                return [4 /*yield*/, client.query(queryerror)];
            case 22:
                resultquerypr = _a.sent();
                _a.label = 23;
            case 23:
                done(null, "END");
                return [3 /*break*/, 25];
            case 24:
                ex_4 = _a.sent();
                done(ex_4.stderr.toString(), null);
                return [3 /*break*/, 25];
            case 25: return [2 /*return*/];
        }
    });
}); });
gqueue.on('completed', function (job, result) {
    console.log("Job " + job.id + " completed with result " + result);
});
gqueue.on('failed', function (job, result) {
    console.log("Job " + job.id + " failed with result " + result);
});
function addJob(data) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, gqueue.add(data)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, 0];
            }
        });
    });
}
var app = express_1.default();
app.use(express_1.default.json());
app.use(cors());
app.use(morgan_1.default("tiny"));
app.post("/grading", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var paquery, results, taskid, answer, code, answerPath, codePath, jobPath, jobdata, json, result, ex_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                return [4 /*yield*/, multerUtil_1.default(req, res)];
            case 1:
                _a.sent();
                if (req.file == undefined) {
                    return [2 /*return*/, res.status(400).send("file upload error")];
                }
                console.log(req.file);
                paquery = {
                    text: 'SELECT task_id FROM t_partcpt_agre WHERE key_value = $1',
                    values: [req.body.key]
                };
                return [4 /*yield*/, client.query(paquery)];
            case 2:
                results = _a.sent();
                if (results.rows.length == 0) {
                    return [2 /*return*/, res.status(400).send("non-existent key")];
                }
                taskid = results.rows[0].task_id;
                answer = "answer";
                code = "code.py";
                answerPath = path_1.default.join(String(process.env.TASK_ROOT), taskid, answer);
                codePath = path_1.default.join(String(process.env.TASK_ROOT), taskid, code);
                jobPath = path_1.default.join(String(process.env.JOB_DIR), path_1.default.basename(req.file.path + ".json"));
                jobdata = {
                    answer: answerPath,
                    file: req.file.path,
                    code: codePath,
                    task: taskid,
                    snFirst: req.body.snFirst,
                    snSecond: req.body.snSecond,
                    jobPath: jobPath
                };
                json = JSON.stringify(jobdata);
                return [4 /*yield*/, promises_1.default.writeFile(jobPath, json, 'utf8')];
            case 3:
                _a.sent();
                return [4 /*yield*/, addJob(jobdata)];
            case 4:
                result = _a.sent();
                if (result == 0) {
                    res.status(200).send("success");
                }
                else {
                    res.status(400).send("job error");
                }
                return [3 /*break*/, 6];
            case 5:
                ex_5 = _a.sent();
                res.status(400).send(ex_5.message);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
app.post("/submit", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var paquery, results, taskid, userid, queryfirst, resultfirst, snFirst, querysecond, resultsecond, snSecond, answer, code, answerPath, codePath, jobPath, jobdata, json, result, ex_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                return [4 /*yield*/, multerUtil_1.default(req, res)];
            case 1:
                _a.sent();
                if (req.file == undefined) {
                    return [2 /*return*/, res.status(400).send("file upload error")];
                }
                paquery = {
                    text: 'SELECT task_id, user_id FROM t_partcpt_agre WHERE key_value = $1',
                    values: [req.body.key]
                };
                return [4 /*yield*/, client.query(paquery)];
            case 2:
                results = _a.sent();
                if (results.rows.length == 0) {
                    return [2 /*return*/, res.status(400).send("non-existent key")];
                }
                taskid = results.rows[0].task_id;
                userid = results.rows[0].user_id;
                queryfirst = {
                    text: 'INSERT INTO T_LAP_ADHRNC (TASK_ID, LAP_SN, ADHRNC_SE_CODE, USER_ID, MODEL_NM, RESULT_SBMISN_MTHD_CODE, REGISTER_ID) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING adhrnc_sn',
                    values: [taskid, 1, '0000', userid, req.body.model, '0000', userid]
                };
                return [4 /*yield*/, client.query(queryfirst)];
            case 3:
                resultfirst = _a.sent();
                snFirst = resultfirst.rows[0].adhrnc_sn;
                querysecond = {
                    text: 'INSERT INTO T_LAP_ADHRNC (TASK_ID, LAP_SN, ADHRNC_SE_CODE, USER_ID, MODEL_NM, RESULT_SBMISN_MTHD_CODE, REGISTER_ID) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING adhrnc_sn',
                    values: [taskid, 1, '0001', userid, req.body.model, '0001', userid]
                };
                return [4 /*yield*/, client.query(querysecond)];
            case 4:
                resultsecond = _a.sent();
                snSecond = resultsecond.rows[0].adhrnc_sn;
                answer = "answer";
                code = "code.py";
                answerPath = path_1.default.join(String(process.env.TASK_ROOT), taskid, answer);
                codePath = path_1.default.join(String(process.env.TASK_ROOT), taskid, code);
                jobPath = path_1.default.join(String(process.env.JOB_DIR), path_1.default.basename(req.file.path + ".json"));
                jobdata = {
                    answer: answerPath,
                    file: req.file.path,
                    code: codePath,
                    task: taskid,
                    snFirst: snFirst,
                    snSecond: snSecond,
                    jobPath: jobPath
                };
                json = JSON.stringify(jobdata);
                return [4 /*yield*/, promises_1.default.writeFile(jobPath, json, 'utf8')];
            case 5:
                _a.sent();
                return [4 /*yield*/, addJob(jobdata)];
            case 6:
                result = _a.sent();
                if (result == 0) {
                    res.status(200).send("success");
                }
                else {
                    res.status(400).send("job error");
                }
                return [3 /*break*/, 8];
            case 7:
                ex_6 = _a.sent();
                res.status(400).send(ex_6.message);
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); });
app.post("/submissionTime", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var dt, submissionTime, paquery, results, taskid, userid, taskquery, resulttask, begindt, enddt, queryfirst, resultfirst, snFirst, querySecond, resultsecond, snSecond, ex_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                dt = new Date();
                submissionTime = dt.toISOString().replace("T", " ").replace("Z", "");
                paquery = {
                    text: 'SELECT task_id, user_id FROM t_partcpt_agre WHERE key_value = $1',
                    values: [req.body.key]
                };
                return [4 /*yield*/, client.query(paquery)];
            case 1:
                results = _a.sent();
                if (results.rows.length == 0) {
                    return [2 /*return*/, res.status(400).send("non-existent key")];
                }
                taskid = results.rows[0].task_id;
                userid = results.rows[0].user_id;
                taskquery = {
                    text: 'SELECT begin_dttm, end_dttm FROM t_task WHERE task_id = $1',
                    values: [taskid]
                };
                return [4 /*yield*/, client.query(taskquery)];
            case 2:
                resulttask = _a.sent();
                if (resulttask.rows.length == 0) {
                    return [2 /*return*/, res.status(400).send("non-existent taskid")];
                }
                begindt = new Date(resulttask.rows[0].begin_dttm);
                enddt = new Date(resulttask.rows[0].end_dttm);
                if (dt > enddt) {
                    return [2 /*return*/, res.status(400).send("submission timeout")];
                }
                queryfirst = {
                    text: 'INSERT INTO T_LAP_ADHRNC (TASK_ID, LAP_SN, ADHRNC_SE_CODE, USER_ID, RESULT_SBMISN_MTHD_CODE, REGISTER_ID, REGIST_DTTM) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING adhrnc_sn',
                    values: [taskid, 1, '0000', userid, '0000', userid, submissionTime]
                };
                return [4 /*yield*/, client.query(queryfirst)];
            case 3:
                resultfirst = _a.sent();
                snFirst = resultfirst.rows[0].adhrnc_sn;
                querySecond = {
                    text: 'INSERT INTO T_LAP_ADHRNC (TASK_ID, LAP_SN, ADHRNC_SE_CODE, USER_ID, RESULT_SBMISN_MTHD_CODE, REGISTER_ID, REGIST_DTTM) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING adhrnc_sn',
                    values: [taskid, 1, '0001', userid, '0001', userid, submissionTime]
                };
                return [4 /*yield*/, client.query(querySecond)];
            case 4:
                resultsecond = _a.sent();
                snSecond = resultsecond.rows[0].adhrnc_sn;
                res.status(200).send("success");
                return [3 /*break*/, 6];
            case 5:
                ex_7 = _a.sent();
                res.status(400).send(ex_7.message);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
app.post("/submitEx", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var paquery, results, taskid, userid, queryfirst, resultfirst, snFirst, querySecond, resultsecond, snSecond, queryerror, resultquerypr, answer, code, answerPath, codePath, jobPath, jobdata, json, result, ex_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 10, , 11]);
                return [4 /*yield*/, multerUtil_1.default(req, res)];
            case 1:
                _a.sent();
                paquery = {
                    text: 'SELECT task_id, user_id FROM t_partcpt_agre WHERE key_value = $1',
                    values: [req.body.key]
                };
                return [4 /*yield*/, client.query(paquery)];
            case 2:
                results = _a.sent();
                if (results.rows.length == 0) {
                    return [2 /*return*/, res.status(400).send("non-existent key")];
                }
                taskid = results.rows[0].task_id;
                userid = results.rows[0].user_id;
                queryfirst = {
                    text: 'SELECT adhrnc_sn FROM t_lap_adhrnc WHERE task_id = $1 and user_id = $2 and adhrnc_se_code = $3 ORDER BY adhrnc_sn DESC LIMIT 1',
                    values: [taskid, userid, '0000']
                };
                return [4 /*yield*/, client.query(queryfirst)];
            case 3:
                resultfirst = _a.sent();
                snFirst = resultfirst.rows[0].adhrnc_sn;
                querySecond = {
                    text: 'SELECT adhrnc_sn FROM t_lap_adhrnc WHERE task_id = $1 and user_id = $2 and adhrnc_se_code = $3 ORDER BY adhrnc_sn DESC LIMIT 1',
                    values: [taskid, userid, '0001']
                };
                return [4 /*yield*/, client.query(querySecond)];
            case 4:
                resultsecond = _a.sent();
                snSecond = resultsecond.rows[0].adhrnc_sn;
                if (!(req.body.error != "none")) return [3 /*break*/, 6];
                queryerror = {
                    text: 'UPDATE T_LAP_ADHRNC SET SCRE = $1, ERR_MESSAGE = $2 WHERE ADHRNC_SN = $3',
                    values: [null, req.body.error, snFirst]
                };
                return [4 /*yield*/, client.query(queryerror)];
            case 5:
                resultquerypr = _a.sent();
                return [2 /*return*/, res.status(200).send("success")];
            case 6:
                if (req.file == undefined) {
                    return [2 /*return*/, res.status(400).send("file upload error")];
                }
                answer = "answer";
                code = "code.py";
                answerPath = path_1.default.join(String(process.env.TASK_ROOT), taskid, answer);
                codePath = path_1.default.join(String(process.env.TASK_ROOT), taskid, code);
                jobPath = path_1.default.join(String(process.env.JOB_DIR), path_1.default.basename(req.file.path + ".json"));
                jobdata = {
                    answer: answerPath,
                    file: req.file.path,
                    code: codePath,
                    task: taskid,
                    snFirst: snFirst,
                    snSecond: snSecond,
                    jobPath: jobPath
                };
                json = JSON.stringify(jobdata);
                return [4 /*yield*/, promises_1.default.writeFile(jobPath, json, 'utf8')];
            case 7:
                _a.sent();
                console.log(jobdata);
                return [4 /*yield*/, addJob(jobdata)];
            case 8:
                result = _a.sent();
                if (result == 0) {
                    res.status(200).send("success");
                }
                else {
                    res.status(400).send("job error");
                }
                _a.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                ex_8 = _a.sent();
                res.status(400).send(ex_8.message);
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); });
app.post("/test", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var answer, code, answerPath, codePath, jobdata, result, ex_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                answer = "answer";
                code = "code.py";
                answerPath = path_1.default.join(String(process.env.TASK_ROOT), String(req.body.taskId), answer);
                codePath = path_1.default.join(String(process.env.TASK_ROOT), String(req.body.taskId), code);
                jobdata = {
                    answer: answerPath,
                    code: codePath,
                    file: answerPath,
                    task: req.body.taskId,
                    snFirst: "code_test",
                };
                return [4 /*yield*/, addJob(jobdata)];
            case 1:
                result = _a.sent();
                if (result == 0) {
                    res.status(200).send("success");
                }
                else {
                    res.status(400).send("job error");
                }
                return [3 /*break*/, 3];
            case 2:
                ex_9 = _a.sent();
                res.status(400).send(ex_9.mesage);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
app.post("/uploadCode", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var dir, newpath, ex_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                return [4 /*yield*/, multerUtilUpload_1.default(req, res)];
            case 1:
                _a.sent();
                if (req.file == undefined) {
                    return [2 /*return*/, res.status(400).send("file upload error")];
                }
                dir = path_1.default.join(String(process.env.TASK_ROOT), String(req.body.taskId));
                if (!!fs_1.default.existsSync(dir)) return [3 /*break*/, 3];
                return [4 /*yield*/, promises_1.default.mkdir(dir)];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                newpath = path_1.default.join(dir, 'code.py');
                return [4 /*yield*/, promises_1.default.rename(req.file.path, newpath)];
            case 4:
                _a.sent();
                res.status(200).send("success");
                return [3 /*break*/, 6];
            case 5:
                ex_10 = _a.sent();
                res.status(400).send(ex_10.message);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
app.post("/uploadAnswer", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var dir, files, _i, files_1, file, ext, newfilename, newpath, ex_11;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 13, , 14]);
                return [4 /*yield*/, multerUtilUpload_1.default(req, res)];
            case 1:
                _a.sent();
                if (req.file == undefined) {
                    return [2 /*return*/, res.status(400).send("file upload error")];
                }
                dir = path_1.default.join(String(process.env.TASK_ROOT), String(req.body.taskId), 'answer');
                if (!!fs_1.default.existsSync(dir)) return [3 /*break*/, 3];
                return [4 /*yield*/, promises_1.default.mkdir(dir, { recursive: true })];
            case 2:
                _a.sent();
                return [3 /*break*/, 8];
            case 3: return [4 /*yield*/, promises_1.default.readdir(dir)];
            case 4:
                files = _a.sent();
                _i = 0, files_1 = files;
                _a.label = 5;
            case 5:
                if (!(_i < files_1.length)) return [3 /*break*/, 8];
                file = files_1[_i];
                return [4 /*yield*/, promises_1.default.unlink(path_1.default.join(dir, file))];
            case 6:
                _a.sent();
                _a.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 5];
            case 8:
                ext = path_1.default.extname(req.file.path);
                newfilename = "answer" + ext;
                newpath = path_1.default.join(dir, newfilename);
                return [4 /*yield*/, promises_1.default.rename(req.file.path, newpath)];
            case 9:
                _a.sent();
                if (!(ext == '.zip')) return [3 /*break*/, 12];
                return [4 /*yield*/, extractzip(newpath, { dir: dir })];
            case 10:
                _a.sent();
                return [4 /*yield*/, promises_1.default.unlink(newpath)];
            case 11:
                _a.sent();
                _a.label = 12;
            case 12:
                res.status(200).send("success");
                return [3 /*break*/, 14];
            case 13:
                ex_11 = _a.sent();
                res.status(400).send(ex_11.message);
                return [3 /*break*/, 14];
            case 14: return [2 /*return*/];
        }
    });
}); });
client
    .connect()
    .then(function () {
    app.listen(PORT, function () {
        console.log("Server is running on port " + PORT + ".");
    });
})
    .catch(function (err) { return console.error('connection error', err.stack); });
//# sourceMappingURL=index.js.map