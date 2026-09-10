import { Router } from "express";
import { UPLOAD_CONTROLLER } from "../controlles/upload.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const uploadRouter = Router();

uploadRouter.post("/upload/presigned-url", authMiddleware, UPLOAD_CONTROLLER.onPresignUrl);

uploadRouter.post("/upload/update-status", authMiddleware, UPLOAD_CONTROLLER.onUpdateStatus);

uploadRouter.post("/upload/complete-multipart", authMiddleware, UPLOAD_CONTROLLER.onCompleteMultipart);

uploadRouter.post("/upload/cancel-upload", authMiddleware, UPLOAD_CONTROLLER.onCancelBeacon);

export default uploadRouter;