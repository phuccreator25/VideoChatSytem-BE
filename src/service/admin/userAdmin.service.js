import { client } from "../../config/database.js";
import env from "../../config/env.js";
import { sendMail } from "../../config/sendMail.js";
import { role } from "../../data/user.data.js";
import { sendMailQueue } from "../../queues/uploadFileQueue.js";
import { DEVICE_SESSION_REPOSITORY } from "../../repository/deviceSession.repository.js";
import { USER_REPOSITORY } from "../../repository/user.repository.js";
import { emitBanUserEvent } from "../../sockets/emitters/auth.emitter.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const onGetDataUser = async ({ filter, page, limit }) => {
    try {
        const dataUsers = await USER_REPOSITORY.findDataUser({ query: filter, page: Number(page), limit: limit });
        return dataUsers
    } catch (error) {
        throw (error)
    }
}

const onCreateAdmin = async ({ payload }) => {
    const { email, password, username, fullname, adminId } = payload

    if (!email || !password || !username || !fullname || !adminId) throw (new Error('All fields are required'));

    const isExistUser = await USER_REPOSITORY.findByEmail(email);
    if (isExistUser) throw (new Error('Email already exists'));

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await USER_REPOSITORY.createOne({
            email,
            password: hashedPassword,
            username,
            fullname,
            role: role.ADMIN,
            isActive: true,
            createdBy: adminId
        })

        return
    } catch (error) {
        throw (error)
    }
}

const onUpdateAdmin = async ({ _id, payload, adminId }) => {
    const [checkUser, currentAdmin] = await Promise.all([
        USER_REPOSITORY.findById(_id),
        USER_REPOSITORY.findById(adminId)
    ]);

    if (!checkUser) throw new Error('User not found');
    if (!currentAdmin) throw new Error('Admin not found');

    const updateData = { ...payload };
    delete updateData._id;

    if (checkUser.role === role.SUPPER_ADMIN && currentAdmin.role !== role.SUPPER_ADMIN) {
        throw new Error('You cannot update information of supper admin');
    }

    if (updateData.role === role.SUPPER_ADMIN) { // Khong cho tự up lên supper admin
        throw new Error('You cannot update role of user to supper admin.');
    }

    if (checkUser.role === role.SUPPER_ADMIN && updateData.role !== role.SUPPER_ADMIN) { // Tránh việc thiếu account supper admin
        const countSupperAdmin = await USER_REPOSITORY.countData({ filters: { role: role.SUPPER_ADMIN } });
        if (countSupperAdmin <= 2) {
            throw (new Error('You cannot update role of supper admin. System need at least 2 supper admin'));
        }
    }

    if (checkUser._id.toString() === adminId.toString() && updateData.role !== checkUser.role) {
        throw (new Error('You cannot update your role'));
    }

    if (checkUser.role !== role.CLIENT && updateData.role === role.CLIENT) {
        throw (new Error('You cannot update role of user from admin to client'));
    }

    const isPasswordChanged = Boolean(updateData.password && updateData.password.trim() !== '');

    if (isPasswordChanged) {
        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        updateData.password = hashedPassword;
    }

    if (updateData.email && updateData.email !== checkUser.email) {
        const isExistUser = await USER_REPOSITORY.findByEmail(updateData.email);
        if (isExistUser) throw (new Error('Email already exists'));
    }

    if (updateData.username && updateData.username !== checkUser.username) {
        const isExistUser = await USER_REPOSITORY.findByUsername(updateData.username);
        if (isExistUser) throw (new Error('Username already exists'));
    }

    updateData.updatedAt = new Date();
    updateData.updatedBy = adminId;

    const session = await client.startSession();

    try {
        session.startTransaction();

        await USER_REPOSITORY.updateById({ _id, data: updateData, options: { session } });

        if (isPasswordChanged || (updateData.role && updateData.role !== checkUser.role)) {
            await DEVICE_SESSION_REPOSITORY.updateMany(
                { userId: _id, revokedAt: null },
                { revokedAt: new Date() },
                { session }
            );
        }

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw (error)
    } finally {
        await session.endSession();
    }

    return
}

const onBanUser = async ({ _id, payload = {}, adminId }) => {

    if (!_id || !adminId) throw new Error('User information is required');

    const [targetUser, actingAdmin] = await Promise.all([
        USER_REPOSITORY.findById(_id),
        USER_REPOSITORY.findById(adminId),
    ]);

    if (!targetUser) throw new Error('User not found');
    if (!actingAdmin) throw new Error('Admin not found');

    if (targetUser._id.toString() === adminId.toString()) throw new Error('You cannot ban yourself');
    if (targetUser.isBanned) throw new Error('User is already banned');
    if (targetUser.role === role.SUPPER_ADMIN) throw new Error('You cannot ban super admin.');

    const allowedFields = {
        banReason: payload.banReason,
        isBanned: true,
        bannedBy: adminId,
        bannedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: adminId,
    };

    const session = await client.startSession();
    try {
        session.startTransaction();

        await USER_REPOSITORY.updateById({
            _id,
            data: allowedFields,
            options: { session },
        });

        await DEVICE_SESSION_REPOSITORY.updateMany(
            { userId: _id, revokedAt: null },
            { revokedAt: new Date() },
            { session }
        );

        await session.commitTransaction();

        emitBanUserEvent(_id.toString(), {
            message: allowedFields.banReason
                ? `Your account has been banned: ${allowedFields.banReason}`
                : "Your account has been banned by an administrator."
        });

        return;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const onUnbanUser = async ({ _id, adminId }) => {

    if (!_id || !adminId) throw new Error('User information is required');

    const targetUser = await USER_REPOSITORY.findById(_id);
    if (!targetUser) throw new Error('User not found');

    if (!targetUser.isBanned) throw new Error('User is not banned');

    try {
        const allowedFields = {
            isBanned: false,
            unbannedBy: adminId,
            unbannedAt: new Date(),
            updatedAt: new Date(),
            updatedBy: adminId,
        };

        await USER_REPOSITORY.updateById({
            _id,
            data: allowedFields,
        });

        return
    } catch (error) {
        throw (error)
    }
}

const onSendMailVerify = async ({ _id }) => {
    try {
        const checkUser = await USER_REPOSITORY.findById(_id);
        if (!checkUser) throw new Error('User not found')

        if (checkUser.isActive) throw new Error('The account has been activated')

        const expiredVerifyTokenAt = new Date(Date.now() + 15 * 60 * 1000);

        const verifyToken = jwt.sign(
            {
                email: checkUser.email,
                type: "active_account",
            },
            env.JWT_SECRET,
            { expiresIn: "15m" },
        );

        const activationLink = `${env.HOST_NAME}/active-account?token=${verifyToken}`;

        await USER_REPOSITORY.updateById({
            _id: checkUser._id,
            data: {
                verifyToken,
                expiredVerifyTokenAt,
                updatedAt: new Date(),
            },
        });

        await sendMailQueue.add("send-mail-queue", {
            to: checkUser.email,
            title: "Account Activation",
            view: "src/views/Mail/Register.viewMail.ejs",
            data: { link: activationLink },
        })

        return

    } catch (error) {
        throw error
    }
}

export const USER_ADMIN_SERVICE = {
    onGetDataUser,
    onCreateAdmin,
    onUpdateAdmin,
    onBanUser,
    onUnbanUser,
    onSendMailVerify,
}