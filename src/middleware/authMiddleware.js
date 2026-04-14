import jwt from 'jsonwebtoken';
import { DEVICE_SESSION_REPOSITORY } from '../repository/deviceSession.repository.js';
import env from '../config/env.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) throw new Error('Bạn chưa đăng nhập') 

    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload) throw new Error('Phiên đăng nhập không hợp lệ')

    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sessionId) throw new Error('Token không hợp lệ')

    const session = await DEVICE_SESSION_REPOSITORY.findOne({ sessionId: decoded.sessionId });
    if (!session || session.revokedAt !== null) throw new Error('Vui lòng đăng nhập lại')

    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Unauthorized' });
  }
};