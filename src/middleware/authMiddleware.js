import jwt from 'jsonwebtoken';
import { DEVICE_SESSION_REPOSITORY } from '../repository/deviceSession.repository.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    
    if(!token){
      throw new Error('Bạn chưa đăng nhập');
    }

    // Decode trước để lấy deviceId, chưa an toàn
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.sessionId) {
      throw new Error('Token không hợp lệ');
    }

    const session  = await DEVICE_SESSION_REPOSITORY.findOne({sessionId: decoded.sessionId});

    if (!session || session.revokedAt !== null) {
      throw new Error('Vui lòng đăng nhập lại');
    }

    // Verify thật sự bằng sessionId lưu trong DB
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};