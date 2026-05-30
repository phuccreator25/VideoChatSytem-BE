import { EXP_REFRESH_TOKEN, EXP_TOKEN } from "../config/auth.js";
import { sendMail } from "../config/sendMail.js";
import { DEVICE_SESSION_REPOSITORY } from "../repository/deviceSession.repository.js";
import { USER_REPOSITORY } from "../repository/user.repository.js";
import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import cloudinary from "../config/cloudinary.js";
import { uploadBufferToCloudinary } from "../helper/uploadBuffer.js";
import {
  addUserSocket,
  disconnectUserSession,
  isUserOnline,
  removeUserSocket,
} from "../sockets/socketStore.js";
import { CONTACT_SERVICE } from "./contacts.service.js";
import {
  emitOnlineUsers,
  emitPresenceChanged,
} from "../sockets/emitters/auth.emitter.js";
import { log } from "console";

const onRegister = async (payload) => {
  try {
    const existingUser = await USER_REPOSITORY.findByEmail(payload.email);

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

    const expiredVerifyTokenAt = new Date(Date.now() + 15 * 60 * 1000);

    const verifyToken = jwt.sign(
      {
        email: payload.email,
        type: "active_account",
      },
      env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const activationLink = `${env.HOST_NAME}/active-account?token=${verifyToken}`;

    if (existingUser) {
      // Xử lý nếu user đã đăng nhập từ trước nhưng chưa active
      if (existingUser.isActive) {
        throw new Error("Email này đã được đăng ký tài khoản");
      }

      await USER_REPOSITORY.updateById({
        _id: existingUser._id,
        data: {
          fullname: payload.fullname,
          password: hashedPassword,
          verifyToken,
          expiredVerifyTokenAt,
          updatedAt: new Date(),
        },
      });

      await sendMail({
        to: existingUser.email,
        title: "Kích hoạt tài khoản",
        view: "src/views/Mail/Register.viewMail.ejs",
        data: { link: activationLink },
      });

      return {
        ...existingUser,
        verifyToken,
        expiredVerifyTokenAt,
      };
    }

    const userData = {
      ...payload,
      password: hashedPassword,
      verifyToken,
      expiredVerifyTokenAt,
      isActive: false,
    };

    const dataCreated = await USER_REPOSITORY.createOne(userData);
    const data = await USER_REPOSITORY.findById(dataCreated.insertedId);

    await sendMail({
      to: data.email,
      title: "Kích hoạt tài khoản",
      view: "src/views/Mail/Register.viewMail.ejs",
      data: { link: activationLink },
    });

    return data;
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    throw error;
  }
};

const onActiveAccount = async (payload) => {
  try {
    const updatedUser = await USER_REPOSITORY.activeAcount(payload);

    if (!updatedUser) {
      throw new Error(
        "Email này đã kích hoạt tài khoản từ trước hoặc không tồn tại",
      );
    }

    return updatedUser;
  } catch (error) {
    console.error("ACTIVE ERROR:", error);
    throw error;
  }
};

const onLogin = async (payload) => {
  try {
    const user = await USER_REPOSITORY.findByEmail(payload.email);

    if (!user) throw new Error("Tài khoản không tồn tại");

    if (!user.isActive) throw new Error("Tài khoản chưa được kích hoạt");

    if (user.isBanned) throw new Error("Tài khoản này đã bị khóa");

    const isPasswordValid = await bcrypt.compare(
      payload.password,
      user.password,
    );

    if (!isPasswordValid) throw new Error("Mật khẩu không chính xác");

    const data = {
      ...payload,
      ...user,
    };

    return await handleDeviceSession(data);
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    throw error;
  }
};

const onLogOut = async (refreshToken) => {
  try {
    if (!refreshToken) {
      throw new Error("Phiên đăng nhập không tồn tại");
    }

    const session = await DEVICE_SESSION_REPOSITORY.findOne({
      refreshToken,
      revokedAt: null,
    });

    if (!session) {
      throw new Error(
        "Phiên đăng nhập của bạn không tồn tại hoặc đã bị đăng xuất",
      );
    }

    const revokedAt = new Date();

    const dataLogOut = await DEVICE_SESSION_REPOSITORY.updateOne(
      { refreshToken },
      {
        revokedAt,
        updatedAt: revokedAt,
      },
    );

    disconnectUserSession(session.userId, session.sessionId);

    return dataLogOut;
  } catch (error) {
    console.error("LOGOUT: ", error);
    throw error;
  }
};

const onForgotPassword = async (payload) => {
  try {
    const result = await USER_REPOSITORY.findByEmail(payload.email);

    if (!result) {
      throw new Error("Tài khoản của bạn không tồn tại");
    }

    const expiredVerifyTokenAt = new Date(Date.now() + 15 * 60 * 1000);

    const verifyToken = jwt.sign(
      {
        id: result._id,
        email: result.email,
        type: "reset_password",
      },
      env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const link = `${process.env.HOST_NAME}/reset-password?token=${verifyToken}`;

    const dataEmail = {
      ...result,
      link,
    };

    await USER_REPOSITORY.updateById({
      _id: result._id,
      data: {
        verifyToken,
        expiredVerifyTokenAt,
      },
    });

    await sendMail({
      to: payload.email,
      title: "Thay đổi mật khẩu",
      view: "src/views/Mail/RessetPassword.ejs",
      data: { dataEmail },
    });

    return true;
  } catch (error) {
    console.error("FORGOT: ", error);
    throw error;
  }
};

const onResetPassword = async (payload) => {
  try {
    const isAccount = await USER_REPOSITORY.findByToken(payload.token);

    if (!isAccount) throw new Error("Tài khoản của bạn không tồn tại");

    if (isAccount.expiredVerifyTokenAt < new Date())
      throw new Error("The password change deadline has passed.");

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

    const dataUpdate = {
      email: isAccount.email,
      password: hashedPassword,
    };

    const data = await USER_REPOSITORY.updateOne(dataUpdate);

    return data;
  } catch (error) {
    console.log("RESET ", error);
    throw error;
  }
};

const onGetUsers = async (payload) => {
  try {
    const users = await USER_REPOSITORY.findById(payload.id);
    return users;
  } catch (error) {
    console.log("GET DATA ", error);
    throw error;
  }
};

const onUpdateUser = async ({ _id, payload }) => {
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

    if (payload.password) {
      if (!payload.currentPass) {
        throw new Error("Vui lòng nhập mật khẩu hiện tại");
      }

      const isMatch = await bcrypt.compare(payload.currentPass, user.password);
      if (!isMatch) {
        throw new Error("Mật khẩu hiện tại không đúng");
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(payload.password, saltRounds);
      updateData.password = hashedPassword;
    }

    if (payload.file) {
      if (user.avatar) {
        const OldAvatar = getPublicIdAvatar(user.avatar);

        if (OldAvatar) {
          try {
            await cloudinary.uploader.destroy(OldAvatar);
          } catch (error) {
            console.log("DELETE OLD AVATAR ERROR:", error);
          }
        }
      }

      const upload = await uploadBufferToCloudinary(payload.file.buffer, {
        folder: "Chat_System_Avatars",
      });

      updateData.avatar = upload.secure_url;
    }

    return await USER_REPOSITORY.updateById({
      _id,
      data: updateData,
    });
  } catch (error) {
    console.log("UPDATE USER: ", error);
    throw error;
  }
};

const onRefreshToken = async (refreshToken) => {
  try {
    const session = await DEVICE_SESSION_REPOSITORY.findOne({
      refreshToken: refreshToken,
    });

    if (!session) {
      throw new Error("Phiên đăng nhập không tồn tại");
    }

    if (session.revokedAt) {
      throw new Error("Phiên đăng nhập đã bị thu hồi, vui lòng đăng nhập lại");
    }

    if (new Date() > new Date(session.expiredAt)) {
      throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
    }

    const user = await USER_REPOSITORY.findById(session.userId);

    if (!user) {
      throw new Error("Tài khoản không tồn tại");
    }

    if (user.isBanned) {
      throw new Error(
        "Tài khoản của bạn đã bị khóa, vui lòng liên hệ bộ phận hỗ trợ",
      );
    }

    const data = {
      ...user,
      ...session,
    };

    return await handleUpdateDeviceSession(data);
  } catch (error) {
    console.log("REFRESH TOKEN ", error);
    throw error;
  }
};

const onSearchUser = async ({ keyword, currentUserId }) => {
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

const onUpdateStatus = async (userId, data = {}) => {
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

const onHandleUserConnected = async ({ userId, sessionId, socket }) => {
  addUserSocket(userId, sessionId, socket);

  await onUpdateStatus(userId, {
    status: "online",
    lastSeenAt: null
  });

  const initialOnlineContactIds =
    await CONTACT_SERVICE.onGetContactOfUserOnline(userId);

  emitOnlineUsers(userId, initialOnlineContactIds);

  initialOnlineContactIds.forEach((contactUserId) => {
    emitPresenceChanged(contactUserId, {
      userId,
      isOnline: true,
      lastSeenAt: null,
    });
  });

  console.log('okoko ', userId);
  
};

const onHandleUserDisconnected = async ({ userId, sessionId, socket }) => {
  removeUserSocket(userId, sessionId, socket.id);

  if (!isUserOnline(userId)) {
    const lastSeenAt = new Date();

    await onUpdateStatus(userId, {
      status: "offline",
      lastSeenAt,
    });

    const onlineContactIds =
      await CONTACT_SERVICE.onGetContactOfUserOnline(userId);

    onlineContactIds.forEach((contactUserId) => {
      emitPresenceChanged(contactUserId, {
        userId,
        isOnline: false,
        lastSeenAt,
      });
    });
  }

  const latestOnlineContactIds =
    await CONTACT_SERVICE.onGetContactOfUserOnline(userId);

  emitOnlineUsers(userId, latestOnlineContactIds);
};

const addDay = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const getPublicIdAvatar = (url) => {
  if (!url) return null;

  const parts = url.split("/upload/");
  if (parts.length < 2) return null;

  const pathWithVersion = parts[1];
  const pathWithoutVersion = pathWithVersion.replace(/^v\d+\//, "");
  const publicId = pathWithoutVersion.replace(/\.[^/.]+$/, "");

  return publicId;
};

const handleDeviceSession = async (data) => {
  const { deviceId } = data;

  const expiredAt = addDay(EXP_REFRESH_TOKEN);
  const sessionId = randomBytes(32).toString("hex");

  const token = jwt.sign({ id: data._id, sessionId }, env.JWT_SECRET, {
    expiresIn: `${EXP_TOKEN}m`,
  });

  const refreshToken = randomBytes(64).toString("hex");

  const dataDeviceSession = {
    sessionId: sessionId,
    userId: data._id.toString(),
    deviceId: deviceId,
    name: deviceId,
    userAgent: data.userAgent,
    refreshToken: refreshToken,
    expiredAt: expiredAt,
    ipAddress: data.ipAddress,
  };

  await DEVICE_SESSION_REPOSITORY.createOne(dataDeviceSession);

  return {
    token,
    refreshToken,
    expiredAt,
    sessionId,
    data,
  };
};

const handleUpdateDeviceSession = async (data) => {
  try {
    const { sessionId } = data;
    const expiredAt = addDay(EXP_REFRESH_TOKEN);

    const token = jwt.sign({ id: data.userId, sessionId }, env.JWT_SECRET, {
      expiresIn: `${EXP_TOKEN}m`,
    });

    const refreshToken = randomBytes(64).toString("hex");

    const dataUpdate = {
      refreshToken: refreshToken,
      expiredAt: expiredAt,
      revokedAt: null,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    await DEVICE_SESSION_REPOSITORY.updateOne({ sessionId }, dataUpdate);

    return {
      token,
      refreshToken,
      expiredAt,
      sessionId,
    };
  } catch (error) {
    console.log("UPDATE DEVICE SESSION ", error);
    throw error;
  }
};

export const USER_SERVICE = {
  onRegister,
  onActiveAccount,
  onLogin,
  onLogOut,
  onForgotPassword,
  onResetPassword,
  onGetUsers,
  onRefreshToken,
  onUpdateUser,
  onSearchUser,
  onUpdateStatus,
  onHandleUserConnected,
  onHandleUserDisconnected,
};
