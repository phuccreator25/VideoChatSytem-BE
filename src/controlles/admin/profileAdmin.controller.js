import { PROFILE_ADMIN_SERVICE } from "../../service/admin/profileAdmin.service.js";
import { UPLOAD_SERVICE } from "../../service/client/upload.service.js";

const onGetProfile = async(req, res, next) => {
    try {
        const adminId = req.admin.id;
        const result = await PROFILE_ADMIN_SERVICE.onGetProfile({_id: adminId});

        return res.status(200).json({
            message: "Get profile successful",
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

const onUpdateProfile = async(req, res, next) => {
    try {
        const adminId = req.admin.id;

        const { fullname, username, currentPassword, newPassword, filename } = req.body;

        const result = await PROFILE_ADMIN_SERVICE.onUpdateProfile({
            _id: adminId, 
            data: {fullname, username, currentPassword, newPassword, filename}, 
            sessionId: req.admin.sessionId
        });

        return res.status(200).json({
            message: "Update profile successful",
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

const onUploadPresign = async(req, res, next) => {
    try {
        const presignUrls = await UPLOAD_SERVICE.onPresignURL({
            files: req.body.files,
            type: "avatar",
            userId: req.admin.id,
        });

        return res.status(200).json({
            message: "Upload presign successful",
            data: presignUrls,
        });
    } catch (error) {
        next(error)
    }
}

export const PROFILE_ADMIN_CONTROLLER = {
    onGetProfile,
    onUpdateProfile,
    onUploadPresign
}