import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { DEVICE_SESSION_REPOSITORY } from '../repository/deviceSession.repository.js';
import { USER_REPOSITORY } from '../repository/user.repository.js';

export const socketMiddleware = async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;

    const token = cookieHeader
      ?.split('; ')
      .find((cookie) => cookie.startsWith('accessToken='))
      ?.split('=')[1];

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

    const user = await USER_REPOSITORY.findById(decoded.id);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.user = user;
    socket.userId = user._id.toString();
    socket.sessionId = session._id.toString();

    console.log(`Socket authentication for user: ${user.fullname}`);
    next();
  } catch (error) {
    return next(new Error('Authentication error: ' + error.message));
  }
};