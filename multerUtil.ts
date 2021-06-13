import util from "util";
import multer from "multer";
import path from "path";
import { getCount } from './count';
const maxSize = 100 * 1024 * 1024;
let storage = multer.diskStorage({
    destination: (req: any, file: any, cb:any) => {
        cb(null, process.env.UPLOAD_DIR);
    },
    filename: (req: any, file:any, cb:any) => {
        console.log(file.originalname);
        let newfileName = new Date().toISOString().replace(/\D/g,'').replace(' ', '') + '-' + getCount() + path.parse(file.originalname).ext;
        cb(null, newfileName);
    },
});

let uploadFile = multer({
  storage: storage,
  limits: { fileSize: maxSize },
}).single("file");

let uploadFileMiddleware = util.promisify(uploadFile);
export default uploadFileMiddleware;