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
var morgan_1 = __importDefault(require("morgan"));
var cors = require('cors');
var pg_1 = require("pg");
var multerUtil_1 = __importDefault(require("./multerUtil"));
var bull_1 = __importDefault(require("bull"));
var spawn = require('await-spawn');
var randomstring = require("randomstring");
var PORT = process.env.PORT || 3045;
var client = new pg_1.Client({
    user: process.env.USER,
    password: process.env.PWD,
    host: process.env.HOST,
    port: parseInt(String(process.env.PORT)),
    database: process.env.DB
});
var gqueue = new bull_1.default('gradeQueue', {
    limiter: {
        max: 100,
        duration: 10000
    },
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
    },
});
gqueue.process(function (job, done) { return __awaiter(void 0, void 0, void 0, function () {
    var codetest, returnResult, ex_1, ex_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                codetest = process.env["CODE_TEST"];
                if (!(job.data.snFirst === "code_test")) return [3 /*break*/, 5];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, spawn('python', [codetest, job.data.answer, job.data.file, job.data.code])];
            case 2:
                returnResult = _a.sent();
                return [3 /*break*/, 4];
            case 3:
                ex_1 = _a.sent();
                done(ex_1.stderr.toString(), null);
                return [3 /*break*/, 4];
            case 4: return [3 /*break*/, 8];
            case 5:
                _a.trys.push([5, 7, , 8]);
                return [4 /*yield*/, spawn('python', [job.data.wrapper, job.data.answer, job.data.file, job.data.code, job.data.snFirst, job.data.snSecond])];
            case 6:
                returnResult = _a.sent();
                return [3 /*break*/, 8];
            case 7:
                ex_2 = _a.sent();
                done(ex_2.stderr.toString(), null);
                return [3 /*break*/, 8];
            case 8:
                done(null, returnResult);
                console.log("gqueue.process end");
                return [2 /*return*/];
        }
    });
}); });
gqueue.on('completed', function (job, result) {
    console.log("Job " + job.id + " completed with result " + result);
});
gqueue.on('failed', function (job, result) {
    console.log("Job " + job.id + " failed with result " + result);
});
var app = express_1.default();
app.use(express_1.default.json());
app.use(cors());
app.use(morgan_1.default("tiny"));
app.post("/aifactory", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var wrapper, answer, code, wrapperPath, answerPath, codePath, jobdata, job, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, multerUtil_1.default(req, res)];
            case 1:
                _a.sent();
                if (req.file == undefined) {
                    return [2 /*return*/, res.status(400).send("false")];
                }
                console.log(req.file);
                wrapper = "test.py";
                answer = "";
                code = "";
                wrapperPath = path_1.default.join(String(process.env.SRC_ROOT), req.body.taskId, wrapper);
                answerPath = path_1.default.join(String(process.env.SRC_ROOT), req.body.taskId, answer);
                codePath = path_1.default.join(String(process.env.SRC_ROOT), req.body.taskId, code);
                jobdata = {
                    wrapper: wrapperPath,
                    answer: answerPath,
                    file: req.file.path,
                    code: codePath,
                    task: req.body.taskId,
                    snFirst: req.body.snFirst,
                    snSecond: req.body.snSecond,
                };
                console.log(jobdata);
                return [4 /*yield*/, gqueue.add(jobdata)];
            case 2:
                job = _a.sent();
                res.status(200).send({
                    "result": "success",
                });
                return [3 /*break*/, 4];
            case 3:
                err_1 = _a.sent();
                res.status(200).send("false");
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
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