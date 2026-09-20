import { EXP_REFRESH_TOKEN, EXP_TOKEN } from "../../config/auth.js";
import { sendMail } from "../../config/sendMail.js";
import { DEVICE_SESSION_REPOSITORY } from "../../repository/deviceSession.repository.js";
import { USER_REPOSITORY } from "../../repository/user.repository.js";
import { USER_MODEL } from "../../models/user.model.js";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import env from "../../config/env.js";
import { disconnectUserSession } from "../../sockets/socketStore.js";
import { emitBanSessionEvent } from "../../sockets/emitters/auth.emitter.js";

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
        throw new Error("This email is already registered");
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
        title: "Account Activation",
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
      title: "Account Activation",
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
        "This email is already activated or does not exist",
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

    if (!user) throw new Error("Account does not exist");

    if (!user.isActive) throw new Error("Account is not activated yet");

    if (user.isBanned) throw new Error("This account has been banned");

    const isPasswordValid = await bcrypt.compare(
      payload.password,
      user.password,
    );

    if (!isPasswordValid) throw new Error("Incorrect password");

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
      throw new Error("Session does not exist");
    }

    const session = await DEVICE_SESSION_REPOSITORY.findOne({
      refreshToken,
      revokedAt: null,
    });

    if (!session) {
      throw new Error(
        "Your session does not exist or has been logged out",
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
      throw new Error("Your account does not exist");
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
      title: "Password Reset Request",
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

    if (!isAccount) throw new Error("Your account does not exist");

    if (isAccount.expiredVerifyTokenAt < new Date())
      throw new Error("The password change deadline has passed.");

    USER_MODEL.validatePassword(payload.password);

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
      throw new Error("Login session does not exist");
    }

    if (session.revokedAt) {
      throw new Error("Login session has been revoked, please log in again");
    }

    if (new Date() > new Date(session.expiredAt)) {
      throw new Error("Login session has expired, please log in again");
    }

    const user = await USER_REPOSITORY.findById(session.userId);

    if (!user) {
      throw new Error("Account does not exist");
    }

    if (user.isBanned) {
      throw new Error(
        "Your account has been locked, please contact support",
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

export const onGetListSession = async ({ currentUserId, currentSessionId }) => {
  try {
    if (!currentUserId) return [];

    const sessions = await DEVICE_SESSION_REPOSITORY.findMany(
      {
        userId: currentUserId.toString(),
        revokedAt: null,
        expiredAt: { $gt: new Date() },
      },
      {
        sort: { lastSeenAt: -1 },
      }
    );

    const formattedSessions = sessions.map((session) => ({
      ...session,
      isCurrentSession: Boolean(currentSessionId && session.sessionId === currentSessionId),
    }));

    formattedSessions.sort((a, b) => (b.isCurrentSession ? 1 : 0) - (a.isCurrentSession ? 1 : 0));

    return formattedSessions;
  } catch (error) {
    throw error;
  }
};

export const onBanSession = async ({ sessionId, currentUserId, currentSessionId }) => {
  try {
    if (!sessionId) throw new Error("Session ID does not exist");

    if (currentSessionId && sessionId === currentSessionId) {
      throw new Error("Cannot revoke current login session!");
    }

    const session = await DEVICE_SESSION_REPOSITORY.findOne({
      sessionId,
      userId: currentUserId.toString(),
      revokedAt: null,
    });

    if (!session) {
      throw new Error("Your login session does not exist");
    }

    const dataUpdate = {
      revokedAt: new Date(),
      updatedAt: new Date(),
    };

    const data = await DEVICE_SESSION_REPOSITORY.updateOne(
      { sessionId },
      dataUpdate,
    );

    emitBanSessionEvent(currentUserId, sessionId, {
      message: "Your login session has been revoked",
    });

    return data;
  } catch (error) {
    console.error("BAN SESSION ERROR:", error);
    throw error;
  }
};

export const onBanAllOtherSessions = async ({ currentUserId, currentSessionId }) => {
  try {
    if (!currentUserId || !currentSessionId) {
      throw new Error("Invalid authentication info");
    }

    const otherSessions = await DEVICE_SESSION_REPOSITORY.findMany({
      userId: currentUserId.toString(),
      sessionId: { $ne: currentSessionId },
      revokedAt: null,
    });

    if (otherSessions.length === 0) {
      throw new Error('No other sessions to revoke');
    }

    await DEVICE_SESSION_REPOSITORY.updateMany(
      {
        userId: currentUserId.toString(),
        sessionId: { $ne: currentSessionId },
        revokedAt: null,
      },
      {
        revokedAt: new Date(),
        updatedAt: new Date(),
      }
    );

    otherSessions.forEach((s) => {
      emitBanSessionEvent(currentUserId, s.sessionId, {
        message: "All your other login sessions have been revoked",
      });
    });

    return otherSessions;
  } catch (error) {
    console.error("BAN ALL SESSIONS ERROR:", error);
    throw error;
  }
};
