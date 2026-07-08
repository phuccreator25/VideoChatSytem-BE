// import { Queue } from "bullmq";
// import IORedis from "ioredis";
// import env from "../config/env.js";

// export const redisConnection = new IORedis({
//   host: env.REDIS_HOST || "http://localhost:5173",
//   port: Number(env.REDIS_PORT) || 6379,
//   maxRetriesPerRequest: null,
// });

// const defaultQueueOptions = {
//   connection: redisConnection,
//   defaultJobOptions: {
//     removeOnComplete: true, // Xóa ngay khi thành công để nhẹ RAM/Ổ cứng
//     removeOnFail: 10,      // Chỉ giữ lại tối đa 10 job lỗi để kiểm tra
//   }
// };

// export const fileUploadQueue = new Queue("file-upload-queue", defaultQueueOptions);
// export const shareMessageQueue = new Queue("share-message-queue", defaultQueueOptions);
// export const linkPreviewQueue = new Queue("link-preview-queue", defaultQueueOptions);

//VERCAL 
import { Queue } from "bullmq";
import IORedis from "ioredis";
import env from "../config/env.js";

// Lấy chuỗi kết nối tổng hợp từ biến môi trường (Ví dụ trên Render)
// Nếu không có, mặc định quay về cấu hình localhost
const REDIS_URL = process.env.REDIS_URL || `redis://${env.REDIS_HOST || '127.0.0.1'}:${Number(env.REDIS_PORT) || 6379}`;

export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  // Thêm cấu hình này nếu Upstash yêu cầu kết nối bảo mật TLS (thường các gói Cloud cần)
  tls: REDIS_URL.startsWith("rediss://") ? {} : undefined
});

const defaultQueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true, // Xóa ngay khi thành công để nhẹ RAM/Ổ cứng
    removeOnFail: 10,      // Chỉ giữ lại tối đa 10 job lỗi để kiểm tra
  }
};

export const fileUploadQueue = new Queue("file-upload-queue", defaultQueueOptions);
export const shareMessageQueue = new Queue("share-message-queue", defaultQueueOptions);
export const linkPreviewQueue = new Queue("link-preview-queue", defaultQueueOptions);
//TIEEPS TỤC ĐƯA LÊN RENDER TEST VIDEOCALL