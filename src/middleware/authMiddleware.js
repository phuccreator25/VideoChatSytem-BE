import jwt from 'jsonwebtoken';
import { DEVICE_SESSION_REPOSITORY } from '../repository/deviceSession.repository.js';
import env from '../config/env.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) throw new Error('You are not logged in') 

    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload) throw new Error('Invalid login session')

    const session = await DEVICE_SESSION_REPOSITORY.findOne({ sessionId: payload.sessionId });
    if (!session || session.revokedAt !== null) throw new Error('Please log in again')

    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Unauthorized' });
  }
};

export const authAdminMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.adminAccessToken;
    if (!token) throw new Error('You are not logged in') 

    const payload = jwt.verify(token, env.JWT_SECRET_ADMIN);
    if (!payload) throw new Error('Invalid login session')

    const session = await DEVICE_SESSION_REPOSITORY.findOne({ sessionId: payload.sessionId });
    if (!session || session.revokedAt !== null) throw new Error('Please log in again')

    req.admin = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Unauthorized' });
  }
};