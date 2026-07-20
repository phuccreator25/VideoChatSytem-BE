import { EXP_REFRESH_TOKEN, EXP_TOKEN } from "../../config/auth.js";
import { sendMail } from "../../config/sendMail.js";
import { DEVICE_SESSION_REPOSITORY } from "../../repository/deviceSession.repository.js";
import { USER_REPOSITORY } from "../../repository/user.repository.js";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import env from "../../config/env.js";
import { disconnectUserSession } from "../../sockets/socketStore.js";

const addDay = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
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

export const onRegister = async (payload) => {
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

export const onActiveAccount = async (payload) => {
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

export const onLogin = async (payload) => {
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

export const onLogOut = async (refreshToken) => {
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

export const onForgotPassword = async (payload) => {
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

export const onResetPassword = async (payload) => {
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

export const onRefreshToken = async (refreshToken) => {
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
