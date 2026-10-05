import { ObjectId } from "mongodb";
import { USER_REPOSITORY } from "../../repository/user.repository.js";
import bcrypt from "bcrypt";
import { DEVICE_SESSION_REPOSITORY } from "../../repository/deviceSession.repository.js";
import { client } from "../../config/database.js";
import { UPLOAD_S3 } from "../../helper/uploadS3.js";

const onGetProfile = async ({ _id }) => {
    try {
        if (!_id) return;

        const admin = await USER_REPOSITORY.findProfileByUser({ filter: { _id: new ObjectId(_id) } })

        return admin

    } catch (error) {
        throw (error)
    }
}

const onUpdateProfile = async ({ _id, data, sessionId }) => {

    if (!_id) throw new Error('Please try again');

    const checkAdmin = await USER_REPOSITORY.findById(_id);
    if (!checkAdmin) throw new Error('Admin not found. Please try again');

    if (data.username && data.username.trim() !== checkAdmin.username) {
        const isExistUserName = await USER_REPOSITORY.findByUsername(data.username.trim());

        if (isExistUserName && String(isExistUserName._id) !== String(_id)) {
            throw new Error('Username already exists');
        }
    }

    const updatedData = {
        updatedAt: new Date()
    };

    if (data.fullname) {
        updatedData.fullname = data.fullname.trim();
    }

    if (data.username) {
        updatedData.username = data.username.trim();
    }

    if (data.currentPassword) {
        const isPasswordMatch = await bcrypt.compare(data.currentPassword, checkAdmin.password);
        if (!isPasswordMatch) throw new Error('Invalid current password');

        if (data.newPassword) {
            updatedData.password = await bcrypt.hash(data.newPassword, 10);
        }
    }

    if (data.filename) {
        const avatarUrl = await UPLOAD_S3.onGetURL("avatar", _id, null, data.filename);
        updatedData.avatar = avatarUrl;
    }

    const session = client.startSession()
    try {
        session.startTransaction()
        await USER_REPOSITORY.updateById({ _id, data: updatedData });
        
        if (updatedData.password) {
            const otherSessions = await DEVICE_SESSION_REPOSITORY.findMany({
                userId: _id.toString(),
                sessionId: { $ne: sessionId },
                revokedAt: null,
            })

            if (otherSessions.length > 0) { // Ban hết session đang login ở nơi khác
                const now = new Date();
                await DEVICE_SESSION_REPOSITORY.updateMany(
                    {
                        userId: _id.toString(),
                        sessionId: { $ne: sessionId },
                        revokedAt: null,
                    },
                    {
                        revokedAt: now,
                        updatedAt: now,
                    }
                );
            }
        }

        await session.commitTransaction();

        const newData = await USER_REPOSITORY.findProfileByUser({
            filter: { _id: new ObjectId(_id) }
        });

        return newData;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};



export const PROFILE_ADMIN_SERVICE = {
    onGetProfile,
    onUpdateProfile
}