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
var moment_timezone_1 = __importDefault(require("moment-timezone"));
//import moment from 'moment';
var extractzip = require('extract-zip');
var spawn = require('await-spawn');
var randomstring = require("randomstring");
var PORT = process.env.PORT;
var client = new pg_1.Client({
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    host: process.env.DB_HOST,
    port: parseInt(String(process.env.DB_PORT)),
    database: process.env.DB_NAME
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
    var pythonexe, returnResult, errMessage, pbScore, prScore, resultfilter, targetfile, ex_1, result, lines, splits, splitssec, query, resultquery, newpath, queryerror, resultquerypr, ex_2, ex_3, result, lines, splits, splitssec, query, resultquery, querypr, resultquerypr, newpath, queryerror, resultquerypr, ex_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                pythonexe = String(process.env.PYTHON_EXE);
                errMessage = "";
                pbScore = 0;
                prScore = 0;
                resultfilter = [];
                if (!(String(job.data.snFirst) == "code_test")) return [3 /*break*/, 12];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                targetfile = job.data.answer;
                return [4 /*yield*/, spawn(pythonexe, [job.data.code, job.data.answer, targetfile])];
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
                    text: 'UPDATE code_test_result SET status = $1, error = $2 WHERE task_id = $3',
                    values: [0, String(pbScore), parseInt(job.data.task)]
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
                    text: 'UPDATE code_test_result SET status = $1, error = $2 WHERE task_id = $3',
                    values: [1, errMessage, parseInt(job.data.task)]
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
                return [4 /*yield*/, spawn(pythonexe, [job.data.code, job.data.answer, job.data.file])];
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
                    text: 'UPDATE task_submission SET score = $1, file = $2, error = $3 WHERE id = $4',
                    values: [pbScore, path_1.default.basename(job.data.file), errMessage, Number(job.data.snFirst)]
                };
                return [4 /*yield*/, client.query(query)];
            case 16:
                resultquery = _a.sent();
                if (!(resultfilter.length > 1)) return [3 /*break*/, 18];
                querypr = {
                    text: 'UPDATE task_submission SET score = $1, file = $2, error = $3 WHERE id = $4',
                    values: [prScore, path_1.default.basename(job.data.file), errMessage, Number(job.data.snSecond)]
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
                    text: 'UPDATE task_submission SET score = $1, file = $2, error = $3 WHERE id = $4',
                    values: [null, path_1.default.basename(job.data.file), errMessage, Number(job.data.snFirst)]
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
var checkDayLimit = function (rules, dbc, ct, taskid, userid) { return __awaiter(void 0, void 0, void 0, function () {
    var localct, localstr, st, et, utcst, utcet, utcststr, utcetstr, dayquery, results;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                localct = ct.clone().tz("Asia/Seoul");
                console.log("localct:" + localct.format("yyyy-MM-DD HH:mm:ss"));
                localstr = localct.format("yyyy-MM-DD") + " 00:00:00";
                console.log("localstr:" + localstr);
                st = moment_timezone_1.default(localstr, "yyyy-MM-DD HH:mm:ss");
                et = moment_timezone_1.default(st).clone().add(Number(rules.daylimit.day), 'days');
                utcst = st.utc();
                utcet = et.utc();
                utcststr = utcst.format('yyyy-MM-DD HH:mm:ss');
                utcetstr = utcet.format('yyyy-MM-DD HH:mm:ss');
                console.log("utcststr:" + utcststr);
                console.log("utcetstr:" + utcetstr);
                dayquery = {
                    text: "SELECT count(*) FROM task_submission where task_id = $1 and user_id = $2 and method_code = 0 and score is not null and error = '' and registration_date BETWEEN $3 AND $4",
                    values: [taskid, userid, utcststr, utcetstr]
                };
                return [4 /*yield*/, client.query(dayquery)];
            case 1:
                results = _a.sent();
                if (Number(results.rows[0].count) > Number(rules.daylimit.count)) {
                    return [2 /*return*/, 1];
                }
                return [2 /*return*/, 0];
        }
    });
}); };
var checkResubmit = function (rules, dbc, ct, taskid, userid) { return __awaiter(void 0, void 0, void 0, function () {
    var lastquery, lastresults, refdt, diff;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                lastquery = {
                    text: "SELECT registration_date FROM task_submission where task_id = $1 and user_id = $2 and method_code = 0 and score is not null and error = '' ORDER BY id DESC LIMIT 1",
                    values: [taskid, userid]
                };
                return [4 /*yield*/, client.query(lastquery)];
            case 1:
                lastresults = _a.sent();
                refdt = moment_timezone_1.default(lastresults.rows[0].registration_date).utc();
                console.log("ct:" + ct.format("yyyy-MM-DD HH:mm:ss"));
                console.log("refdt:" + refdt.format("yyyy-MM-DD HH:mm:ss"));
                diff = moment_timezone_1.default.duration(ct.diff(refdt)).asMinutes();
                if (diff < Number(rules.resubmit.min)) {
                    return [2 /*return*/, 2];
                }
                return [2 /*return*/, 0];
        }
    });
}); };
var checkRule = function (rules, dbc, ct, taskid, userid) { return __awaiter(void 0, void 0, void 0, function () {
    var ret, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                ret = 0;
                _a = rules.type;
                switch (_a) {
                    case 0: return [3 /*break*/, 1];
                    case 1: return [3 /*break*/, 2];
                    case 2: return [3 /*break*/, 4];
                    case 3: return [3 /*break*/, 6];
                }
                return [3 /*break*/, 9];
            case 1: return [3 /*break*/, 10];
            case 2: return [4 /*yield*/, checkDayLimit(rules, dbc, ct, taskid, userid)];
            case 3:
                ret = _b.sent();
                return [3 /*break*/, 10];
            case 4: return [4 /*yield*/, checkResubmit(rules, dbc, ct, taskid, userid)];
            case 5:
                ret = _b.sent();
                return [3 /*break*/, 10];
            case 6: return [4 /*yield*/, checkDayLimit(rules, dbc, ct, taskid, userid)];
            case 7:
                ret = _b.sent();
                if (ret > 0)
                    return [2 /*return*/, ret];
                return [4 /*yield*/, checkResubmit(rules, dbc, ct, taskid, userid)];
            case 8:
                ret = _b.sent();
                return [3 /*break*/, 10];
            case 9: return [3 /*break*/, 10];
            case 10: return [2 /*return*/, ret];
        }
    });
}); };
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
    var paquery, results, taskid, answer, code, taskpath, answerfile, answerPath, files, codePath, jobPath, jobdata, json, result, ex_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                return [4 /*yield*/, multerUtil_1.default(req, res)];
            case 1:
                _a.sent();
                if (req.file == undefined) {
                    return [2 /*return*/, res.status(400).send("file upload error")];
                }
                console.log(req.file);
                paquery = {
                    text: 'SELECT task_id FROM task_user WHERE key = $1',
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
                taskpath = path_1.default.join(String(process.env.TASK_ROOT), taskid.toString());
                answerfile = void 0;
                answerPath = path_1.default.join(taskpath, answer);
                return [4 /*yield*/, promises_1.default.readdir(answerPath)];
            case 3:
                files = _a.sent();
                if (files.length > 1) {
                    answerfile = answerPath; // zip
                }
                else if (files.length == 1) {
                    answerfile = path_1.default.join(answerPath, files[0]); // single file 
                }
                else {
                    return [2 /*return*/, res.status(400).send("no answer file")];
                }
                codePath = path_1.default.join(taskpath, code);
                jobPath = path_1.default.join(String(process.env.JOB_DIR), path_1.default.basename(req.file.path + ".json"));
                jobdata = {
                    answer: answerfile,
                    file: req.file.path,
                    code: codePath,
                    task: taskid,
                    snFirst: req.body.snFirst,
                    snSecond: req.body.snSecond,
                    jobPath: jobPath
                };
                json = JSON.stringify(jobdata);
                return [4 /*yield*/, promises_1.default.writeFile(jobPath, json, 'utf8')];
            case 4:
                _a.sent();
                return [4 /*yield*/, addJob(jobdata)];
            case 5:
                result = _a.sent();
                if (result == 0) {
                    res.status(200).send("success");
                }
                else {
                    res.status(400).send("job error");
                }
                return [3 /*break*/, 7];
            case 6:
                ex_5 = _a.sent();
                res.status(400).send(ex_5.message);
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
app.post("/submit", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var paquery, results, ct, taskid, userid, taskquery, resulttask, startdt, enddt, rules, ret, queryfirst, resultfirst, snFirst, querysecond, resultsecond, snSecond, answer, code, taskpath, answerfile, answerPath, files, codePath, jobPath, jobdata, json, result, ex_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 10, , 11]);
                return [4 /*yield*/, multerUtil_1.default(req, res)];
            case 1:
                _a.sent();
                if (req.file == undefined) {
                    return [2 /*return*/, res.status(400).send("file upload error")];
                }
                paquery = {
                    text: 'SELECT task_id, user_id FROM task_user WHERE key = $1',
                    values: [req.body.key]
                };
                return [4 /*yield*/, client.query(paquery)];
            case 2:
                results = _a.sent();
                if (results.rows.length == 0) {
                    return [2 /*return*/, res.status(400).send("non-existent key")];
                }
                ct = moment_timezone_1.default().utc();
                taskid = results.rows[0].task_id;
                userid = results.rows[0].user_id;
                taskquery = {
                    text: 'SELECT start_date, end_date, rules FROM task WHERE id = $1',
                    values: [taskid]
                };
                return [4 /*yield*/, client.query(taskquery)];
            case 3:
                resulttask = _a.sent();
                if (resulttask.rows.length == 0) {
                    return [2 /*return*/, res.status(400).send("non-existent taskid")];
                }
                startdt = resulttask.rows[0].start_date;
                enddt = moment_timezone_1.default(resulttask.rows[0].end_date).utc();
                rules = JSON.parse(resulttask.rows[0].rules);
                if (ct > enddt) {
                    return [2 /*return*/, res.status(400).send("submission timeout")];
                }
                return [4 /*yield*/, checkRule(rules, client, ct, taskid, userid)];
            case 4:
                ret = _a.sent();
                if (ret > 0) {
                    return [2 /*return*/, res.status(400).send("violation of the rules:" + ret)];
                }
                queryfirst = {
                    text: 'INSERT INTO task_submission (task_id, lap, se_code, user_id, model_name, method_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    values: [taskid, 1, 0, userid, req.body.model, 0]
                };
                return [4 /*yield*/, client.query(queryfirst)];
            case 5:
                resultfirst = _a.sent();
                snFirst = resultfirst.rows[0].id;
                querysecond = {
                    text: 'INSERT INTO task_submission (task_id, lap, se_code, user_id, model_name, method_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    values: [taskid, 1, 1, userid, req.body.model, 1]
                };
                return [4 /*yield*/, client.query(querysecond)];
            case 6:
                resultsecond = _a.sent();
                snSecond = resultsecond.rows[0].id;
                answer = "answer";
                code = "code.py";
                taskpath = path_1.default.join(String(process.env.TASK_ROOT), taskid.toString());
                answerfile = void 0;
                answerPath = path_1.default.join(taskpath, answer);
                return [4 /*yield*/, promises_1.default.readdir(answerPath)];
            case 7:
                files = _a.sent();
                if (files.length > 1) {
                    answerfile = answerPath; // zip
                }
                else if (files.length == 1) {
                    answerfile = path_1.default.join(answerPath, files[0]); // single file 
                }
                else {
                    return [2 /*return*/, res.status(400).send("no answer file")];
                }
                codePath = path_1.default.join(taskpath, code);
                jobPath = path_1.default.join(String(process.env.JOB_DIR), path_1.default.basename(req.file.path + ".json"));
                jobdata = {
                    answer: answerfile,
                    file: req.file.path,
                    code: codePath,
                    task: taskid,
                    snFirst: snFirst,
                    snSecond: snSecond,
                    jobPath: jobPath
                };
                json = JSON.stringify(jobdata);
                return [4 /*yield*/, promises_1.default.writeFile(jobPath, json, 'utf8')];
            case 8:
                _a.sent();
                return [4 /*yield*/, addJob(jobdata)];
            case 9:
                result = _a.sent();
                if (result == 0) {
                    res.status(200).send("success");
                }
                else {
                    res.status(400).send("job error");
                }
                return [3 /*break*/, 11];
            case 10:
                ex_6 = _a.sent();
                res.status(400).send(ex_6.message);
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); });
app.post("/submissionTime", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var ct, paquery, results, taskid, userid, taskquery, resulttask, startdt, enddt, rules, ret, reterror, queryfirst, resultfirst, snFirst, querySecond, resultsecond, snSecond, ex_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                ct = moment_timezone_1.default().utc();
                console.log("ct:" + ct.format("yyyy-MM-DD HH:mm:ss"));
                paquery = {
                    text: 'SELECT task_id, user_id FROM task_user WHERE key = $1',
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
                    text: 'SELECT start_date, end_date, rules FROM task WHERE id = $1',
                    values: [taskid]
                };
                return [4 /*yield*/, client.query(taskquery)];
            case 2:
                resulttask = _a.sent();
                if (resulttask.rows.length == 0) {
                    return [2 /*return*/, res.status(400).send("non-existent taskid")];
                }
                console.log(resulttask.rows[0].start_date);
                console.log(resulttask.rows[0].end_date);
                startdt = resulttask.rows[0].start_date;
                enddt = moment_timezone_1.default(resulttask.rows[0].end_date).utc();
                console.log(startdt);
                console.log(enddt);
                rules = JSON.parse(resulttask.rows[0].rules);
                if (ct > enddt) {
                    return [2 /*return*/, res.status(400).send("submission timeout")];
                }
                return [4 /*yield*/, checkRule(rules, client, ct, taskid, userid)];
            case 3:
                ret = _a.sent();
                if (ret > 0) {
                    reterror = "error";
                    switch (ret) {
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
                    return [2 /*return*/, res.status(400).send(reterror)];
                }
                queryfirst = {
                    text: 'INSERT INTO task_submission (task_id, lap, se_code, user_id, method_code) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    values: [taskid, 1, 0, userid, 0]
                };
                return [4 /*yield*/, client.query(queryfirst)];
            case 4:
                resultfirst = _a.sent();
                snFirst = resultfirst.rows[0].id;
                querySecond = {
                    text: 'INSERT INTO task_submission (task_id, lap, se_code, user_id, method_code) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    values: [taskid, 1, 1, userid, 1]
                };
                return [4 /*yield*/, client.query(querySecond)];
            case 5:
                resultsecond = _a.sent();
                snSecond = resultsecond.rows[0].id;
                res.status(200).send("success");
                return [3 /*break*/, 7];
            case 6:
                ex_7 = _a.sent();
                console.log("step error");
                res.status(400).send(ex_7.message);
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
app.post("/submitEx", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var paquery, results, taskid, userid, queryfirst, resultfirst, snFirst, querySecond, resultsecond, snSecond, queryerror, resultquerypr, answer, code, taskpath, answerfile, answerPath, files, codePath, jobPath, jobdata, json, result, ex_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 11, , 12]);
                return [4 /*yield*/, multerUtil_1.default(req, res)];
            case 1:
                _a.sent();
                console.log(req.body);
                paquery = {
                    text: 'SELECT task_id, user_id FROM task_user WHERE key = $1',
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
                    text: 'SELECT id FROM task_submission WHERE task_id = $1 and user_id = $2 and se_code = $3 ORDER BY id DESC LIMIT 1',
                    values: [taskid, userid, 0]
                };
                return [4 /*yield*/, client.query(queryfirst)];
            case 3:
                resultfirst = _a.sent();
                snFirst = resultfirst.rows[0].id;
                querySecond = {
                    text: 'SELECT id FROM task_submission WHERE task_id = $1 and user_id = $2 and se_code = $3 ORDER BY id DESC LIMIT 1',
                    values: [taskid, userid, 1]
                };
                return [4 /*yield*/, client.query(querySecond)];
            case 4:
                resultsecond = _a.sent();
                snSecond = resultsecond.rows[0].id;
                if (!(req.body.error != "none")) return [3 /*break*/, 6];
                queryerror = {
                    text: 'UPDATE task_submission SET score = $1, error = $2 WHERE id = $3',
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
                taskpath = path_1.default.join(String(process.env.TASK_ROOT), taskid.toString());
                answerfile = void 0;
                answerPath = path_1.default.join(taskpath, answer);
                return [4 /*yield*/, promises_1.default.readdir(answerPath)];
            case 7:
                files = _a.sent();
                if (files.length > 1) {
                    answerfile = answerPath; // zip
                }
                else if (files.length == 1) {
                    answerfile = path_1.default.join(answerPath, files[0]); // single file 
                }
                else {
                    return [2 /*return*/, res.status(400).send("no answer file")];
                }
                codePath = path_1.default.join(taskpath, code);
                jobPath = path_1.default.join(String(process.env.JOB_DIR), path_1.default.basename(req.file.path + ".json"));
                jobdata = {
                    answer: answerfile,
                    file: req.file.path,
                    code: codePath,
                    task: taskid,
                    snFirst: snFirst,
                    snSecond: snSecond,
                    jobPath: jobPath
                };
                json = JSON.stringify(jobdata);
                return [4 /*yield*/, promises_1.default.writeFile(jobPath, json, 'utf8')];
            case 8:
                _a.sent();
                console.log(jobdata);
                return [4 /*yield*/, addJob(jobdata)];
            case 9:
                result = _a.sent();
                if (result == 0) {
                    res.status(200).send("success");
                }
                else {
                    res.status(400).send("job error");
                }
                _a.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                ex_8 = _a.sent();
                res.status(400).send(ex_8.message);
                return [3 /*break*/, 12];
            case 12: return [2 /*return*/];
        }
    });
}); });
app.post("/test", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var answer, code, taskpath, answerfile, answerPath, files, codePath, jobdata, result, ex_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                answer = "answer";
                code = "code.py";
                taskpath = path_1.default.join(String(process.env.TASK_ROOT), req.body.taskId.toString());
                answerfile = void 0;
                answerPath = path_1.default.join(taskpath, answer);
                return [4 /*yield*/, promises_1.default.readdir(answerPath)];
            case 1:
                files = _a.sent();
                if (files.length > 1) {
                    answerfile = answerPath; // zip
                }
                else if (files.length == 1) {
                    answerfile = path_1.default.join(answerPath, files[0]); // single file 
                }
                else {
                    return [2 /*return*/, res.status(400).send("no answer file")];
                }
                codePath = path_1.default.join(taskpath, code);
                jobdata = {
                    answer: answerfile,
                    code: codePath,
                    file: answerPath,
                    task: req.body.taskId,
                    snFirst: "code_test",
                };
                return [4 /*yield*/, addJob(jobdata)];
            case 2:
                result = _a.sent();
                if (result == 0) {
                    res.status(200).send("success");
                }
                else {
                    res.status(400).send("job error");
                }
                return [3 /*break*/, 4];
            case 3:
                ex_9 = _a.sent();
                res.status(400).send(ex_9.message);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
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