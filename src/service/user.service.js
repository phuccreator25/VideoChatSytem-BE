import { log } from "console";
import { EXP_REFRESH_TOKEN, EXP_TOKEN } from "../config/auth.js";
import { sendMail } from "../config/sendMail.js";
import { DEVICE_SESSION_REPOSITORY } from "../repository/deviceSession.repository.js";
import { USER_REPOSITORY } from "../repository/user.repository.js";
import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "crypto";
import jwt, { decode } from "jsonwebtoken";
import env from "../config/env.js";
import cloudinary from "../config/cloudinary.js";
import { uploadBufferToCloudinary } from "../helper/uploadBuffer.js";

const onRegister = async (payload) => {
  try {
    const existingUser = await USER_REPOSITORY.findByEmail(payload.email);

    if (existingUser) {
      throw new Error("Email này đã được đăng ký tài khoản");
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

    const userData = {
      ...payload,
      password: hashedPassword,
    };

    const dataCreated = await USER_REPOSITORY.createOne(userData);

    const data = await USER_REPOSITORY.findById(dataCreated.insertedId);

    await sendMail({
      to: data.email,
      title: "Kích hoạt tài khoản",
      view: "src/views/Mail/Register.viewMail.ejs",
      data: { link: payload.link },
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

    if(!user.isActive) throw new Error("Tài khoản chưa được kích hoạt");

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

const onLogOut = async (payload) => {
  try {
    const token = payload;
    const dataToken = jwt.decode(token);

    const dataLogOut = DEVICE_SESSION_REPOSITORY.updateOne(
      { sessionId: dataToken.sessionId },
      {
        revokedAt: new Date(),
        updateAt: new Date(),
      },
    );

    if (dataLogOut.matchedCount === 0) {
      throw new Error("Phiên đăng nhập của bạn không tồn tại");
    }

    return dataLogOut;
  } catch (error) {
    console.error("LOGOUT: ", error);
    throw error;
  }
};

const onForgotPassword = async (payload) => {
  try {
    const result = await USER_REPOSITORY.findByEmail(payload.email);

    if (!result) throw new Error("Tài khoản của bạn không tồn tại");

    const link = `${process.env.HOST_NAME}/reset-password/${payload.email}`;

    const dataEmail = {
      ...result,
      link,
    };

    await sendMail({
      to: payload.email,
      title: "Thay đổi mật khẩu",
      view: "src/views/Mail/RessetPassword.ejs",
      data: { dataEmail },
    });
  } catch (error) {
    console.error("FORGOT: ", error);
    throw error;
  }
};

const onResetPassword = async (payload) => {
  try {
    const isAccount = await USER_REPOSITORY.findByEmail(payload.email);

    if (!isAccount) throw new Error("Tài khoản của bạn không tồn tại");

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

    const dataUpdate = {
      email: payload.email,
      password: hashedPassword,
    };

    await USER_REPOSITORY.updateOne(dataUpdate);
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

    const token = jwt.sign(
      { id: data.userId, sessionId },
      env.JWT_SECRET,
      { expiresIn: `${EXP_TOKEN}m` },
    );

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

const onUpdateUser = async ({ _id, payload }) => {
  try {
    const user = await USER_REPOSITORY.findById(_id)
    if (!user) throw new Error("Không tìm thấy tài khoản cần cập nhật")

    const updateData = {}

    if (payload.fullname !== undefined) {
      updateData.fullname = payload.fullname
    }

    if (payload.username !== undefined) {
      updateData.username = payload.username
    }

    if (payload.password) {
      if (!payload.currentPass) {
        throw new Error("Vui lòng nhập mật khẩu hiện tại")
      }

      const isMatch = await bcrypt.compare(payload.currentPass, user.password)
      if (!isMatch) {
        throw new Error("Mật khẩu hiện tại không đúng")
      }

      const saltRounds = 10
      const hashedPassword = await bcrypt.hash(payload.password, saltRounds)
      updateData.password = hashedPassword
    }

    if (payload.file) {
      if(user.avatar){
        const OldAvatar = getPublicIdAvatar(user.avatar);

        if(OldAvatar){
          try {
            await cloudinary.uploader.destroy(OldAvatar)
          } catch (error) {
            console.log('DELETE OLD AVATAR ERROR:', error)
          }
        }
      }
      
      const upload = await uploadBufferToCloudinary(payload.file.buffer, {
        folder: 'Chat_System_Avatars'
      })

      updateData.avatar = upload.secure_url
    }

    return await USER_REPOSITORY.updateById({
      _id,
      data: updateData
    })
  } catch (error) {
    console.log("UPDATE USER: ", error)
    throw error
  }
}

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

const addDay = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const getPublicIdAvatar = (url) => {
  if (!url) return null

  const parts = url.split('/upload/')
  if (parts.length < 2) return null

  const pathWithVersion = parts[1]
  const pathWithoutVersion = pathWithVersion.replace(/^v\d+\//, '')
  const publicId = pathWithoutVersion.replace(/\.[^/.]+$/, '')

  return publicId
}

const onSearchUser = async ({ keyword, currentUserId }) => {
  try {
    if (!keyword?.trim()) return [];

    const users = await USER_REPOSITORY.findByUser({
      keyword,
      currentUserId
    });

    return users;
  } catch (error) {
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
  onSearchUser
};
