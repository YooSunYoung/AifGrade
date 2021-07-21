"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var util_1 = __importDefault(require("util"));
var multer_1 = __importDefault(require("multer"));
var path_1 = __importDefault(require("path"));
var maxSize = 100 * 1024 * 1024;
var storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, process.env.UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        var newfileName = new Date().toISOString().replace(/\D/g, '').replace(' ', '') + path_1.default.parse(file.originalname).ext;
        cb(null, newfileName);
    },
});
var upload = multer_1.default({
    storage: storage,
    limits: { fileSize: maxSize },
}).single("file");
var uploadMiddleware = util_1.default.promisify(upload);
exports.default = uploadMiddleware;
//# sourceMappingURL=multerUtilUpload.js.map