import { USER_REPOSITORY } from "../../repository/user.repository.js";
import { USER_MODEL } from "../../models/user.model.js";
import { DEVICE_SESSION_REPOSITORY } from "../../repository/deviceSession.repository.js";
import { emitBanSessionEvent} from "../../sockets/emitters/auth.emitter.js";
import bcrypt from "bcrypt";
import { UPLOAD_S3 } from "../../helper/uploadS3.js";

export const onGetUserById = async (payload) => {
  try {
    return await USER_REPOSITORY.findById(payload.id);
  } catch (error) {
    console.log("GET DATA ", error);
    throw error;
  }
};


export const onUpdateUser = async ({ _id, sessionId, payload }) => {
  try {
    const user = await USER_REPOSITORY.findById(_id);
    if (!user) throw new Error("Không tìm thấy tài khoản cần cập nhật");

    const updateData = {};

    if (payload.fullname !== undefined) {
      updateData.fullname = payload.fullname;
    }

    if (payload.username !== undefined) {
      updateData.username = payload.username;
    }
      
    let isPasswordChanged = false;

    if (payload.password) {
      if (!payload.currentPass) {
        throw new Error("Vui lòng nhập mật khẩu hiện tại");
      }

      USER_MODEL.validatePassword(payload.password);

      const isMatch = await bcrypt.compare(payload.currentPass, user.password);
      if (!isMatch) {
        throw new Error("Mật khẩu hiện tại không đúng");
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(payload.password, saltRounds);
      updateData.password = hashedPassword;
      isPasswordChanged = true;
    }

    if (payload.fileName) {
      const avatarUrl = await UPLOAD_S3.onGetURL("avatar", _id, null, payload.fileName);
      
      updateData.avatar = avatarUrl;
    }

    const updatedUser = await USER_REPOSITORY.updateById({
      _id,
      data: updateData,
    });

    if (isPasswordChanged && sessionId) {
      const otherSessions = await DEVICE_SESSION_REPOSITORY.findMany({
        userId: _id.toString(),
        sessionId: { $ne: sessionId },
        revokedAt: null,
      });

      if (otherSessions.length > 0) {
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

        otherSessions.forEach((s) => {
          emitBanSessionEvent(_id.toString(), s.sessionId, {
            message: "Mật khẩu của bạn đã được thay đổi. Vui lòng đăng nhập lại!",
          });
        });
      }
    }

    return updatedUser;
  } catch (error) {
    console.log("UPDATE USER: ", error);
    throw error;
  }
};

export const onSearchUser = async ({ keyword, currentUserId }) => {
  try {
    if (!keyword?.trim()) return [];

    const users = await USER_REPOSITORY.findByUser({
      keyword,
      currentUserId,
    });

    return users;
  } catch (error) {
    throw error;
  }
};

export const onUpdateStatus = async (userId, data = {}) => {
  const updateData = {
    status: data.status,
  };

  if (data.lastSeenAt !== undefined) {
    updateData.lastSeenAt = data.lastSeenAt;
  }

  return await USER_REPOSITORY.updateById({
    _id: userId,
    data: updateData,
  });
};
