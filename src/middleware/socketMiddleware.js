import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { DEVICE_SESSION_REPOSITORY } from '../repository/deviceSession.repository.js';
import { USER_REPOSITORY } from '../repository/user.repository.js';

const parseCookieHeader = (cookieHeader = '') => {
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const separatorIndex = item.indexOf('=');
      if (separatorIndex <= 0) return acc;

      const key = item.slice(0, separatorIndex).trim();
      const rawValue = item.slice(separatorIndex + 1).trim();

      try {
        acc[key] = decodeURIComponent(rawValue);
      } catch {
        acc[key] = rawValue;
      }

      return acc;
    }, {});
};

export const socketMiddleware = async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies.accessToken;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (!decoded) {
      return next(new Error('Authentication error: Invalid token'));
    }

    const session = await DEVICE_SESSION_REPOSITORY.findOne({
      sessionId: decoded.sessionId,
    });

    if (!session || session.revokedAt !== null) {
      return next(new Error('Authentication error: Session revoked or not found'));
    }

    if (session.expiredAt < new Date()) {
      return next(new Error('Authentication error: Session expired'));
    }

    const user = await USER_REPOSITORY.findById(decoded.id);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    if(user.isBanned){
      return next(new Error('This account has been locked.'));
    }

    if(!user.isActive){
      return next(new Error('This account has not been activated.'));
    }

    socket.user = user;
    socket.userId = user._id.toString();
    socket.sessionId = session.sessionId.toString();

    console.log(`Socket authentication for user: ${user.fullname}`);
    next();
  } catch (error) {
    return next(new Error('Authentication error: ' + error.message));
  }
};
