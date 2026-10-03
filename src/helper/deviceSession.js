import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { DEVICE_SESSION_REPOSITORY } from "../repository/deviceSession.repository.js";
import { EXP_REFRESH_TOKEN, EXP_TOKEN } from "../config/auth.js";
import { role } from "../data/user.data.js";

const addDay = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

export const handleDeviceSession = async (data) => {
  const { deviceId } = data;

  const expiredAt = addDay(EXP_REFRESH_TOKEN);
  const sessionId = randomBytes(32).toString("hex");

  const token = jwt.sign({ id: data._id, sessionId }, data.role === role.CLIENT ? env.JWT_SECRET : env.JWT_SECRET_ADMIN, {
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
