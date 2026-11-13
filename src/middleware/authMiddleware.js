import jwt from 'jsonwebtoken';
import { DEVICE_SESSION_REPOSITORY } from '../repository/deviceSession.repository.js';
import env from '../config/env.js';
import { REDIS } from '../cache/redis.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) {
      return res.status(401).json({ message: 'You are not logged in' });
    }

    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload?.id || !payload?.sessionId) {
      return res.status(401).json({ message: 'Invalid login session' });
    }

    const cacheKeySession = `user_sessions:${payload.id.toString()}`;
    const cacheKeyUser = `user_block:${payload.id.toString()}`;

    const [isUserBlocked, sessionData] = await Promise.all([
      REDIS.redisGet(cacheKeyUser),
      REDIS.redisHGet(cacheKeySession, payload.sessionId)
    ]);

    if (isUserBlocked) {
      return res.status(403).json({ message: 'Account has been banned' });
    }

    if (!sessionData) {
      const session = await DEVICE_SESSION_REPOSITORY.findOne({ sessionId: payload.sessionId });

      if (!session || session.revokedAt !== null || new Date(session.expiredAt) <= new Date()) {
        return res.status(401).json({ message: 'Please log in again' });
      }

      const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
      if (remainingTtl > 0) {
        await REDIS.redisHSet({
          key: cacheKeySession,
          field: session.sessionId,
          value: JSON.stringify({ userId: session.userId.toString(), status: 'active' }),
          ttl: remainingTtl
        });
      }
    }

    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Unauthorized' });
  }
};

export const authAdminMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.adminAccessToken;
    if (!token) {
      return res.status(401).json({ message: 'You are not logged in' });
    }

    const payload = jwt.verify(token, env.JWT_SECRET_ADMIN);
    if (!payload?.id || !payload?.sessionId) {
      return res.status(401).json({ message: 'Invalid login session' });
    }

    const cacheKeySession = `user_sessions:${payload.id.toString()}`;
    const cacheKeyAdminBlock = `user_block:${payload.id.toString()}`;

    const [isAdminBlocked, cachedSession] = await Promise.all([
      REDIS.redisGet(cacheKeyAdminBlock),
      REDIS.redisHGet(cacheKeySession, payload.sessionId)
    ]);

    if (isAdminBlocked) {
      return res.status(403).json({ message: 'Your admin access has been revoked' });
    }

    if (!cachedSession) {
      const session = await DEVICE_SESSION_REPOSITORY.findOne({ sessionId: payload.sessionId});

      if (!session || session.revokedAt !== null || new Date(session.expiredAt) <= new Date()) {
        return res.status(401).json({ message: 'Please log in again' });
      }

      const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
      if (remainingTtl > 0) {
        await REDIS.redisHSet({
          key: cacheKeySession,
          field: session.sessionId,
          value: JSON.stringify({ userId: session.userId.toString(), status: 'active' }),
          ttl: remainingTtl
        });
      }
    }

    req.admin = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Unauthorized' });
  }
};