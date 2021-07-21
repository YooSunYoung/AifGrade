import util from "util";
import multer from "multer";
import path from "path";
const maxSize = 100 * 1024 * 1024;
let storage = multer.diskStorage({
    destination: (req: any, file: any, cb:any) => {
        cb(null, process.env.UPLOAD_DIR);
    },
    filename: (req: any, file:any, cb:any) => {
        let newfileName = new Date().toISOString().replace(/\D/g,'').replace(' ', '') +  path.parse(file.originalname).ext;
        cb(null, newfileName);
    },
});

let upload = multer({
  storage: storage,
  limits: { fileSize: maxSize },
}).single("file");

let uploadMiddleware = util.promisify(upload);
export default uploadMiddleware;