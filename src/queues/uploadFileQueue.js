import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import env from "../config/env.js";

export const redisConnection = new IORedis({
  host: env.REDIS_HOST || "127.0.0.1",
  port: Number(env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
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
export const sendMessageQueue = new Queue("send-message-queue", defaultQueueOptions);
export const sendMessageQueueEvents = new QueueEvents("send-message-queue", { connection: redisConnection });

//VERCAL
// import { Queue, QueueEvents } from "bullmq";
// import IORedis from "ioredis";
// import env from "../config/env.js";

// Lấy chuỗi kết nối tổng hợp từ biến môi trường (Ví dụ trên Render)
// Nếu không có, mặc định quay về cấu hình localhost
// const REDIS_URI = env.REDIS_URI; 

// console.log(REDIS_URI);

// export const redisConnection = new IORedis(REDIS_URI, {
//   maxRetriesPerRequest: null,
//   // Thêm cấu hình này nếu Upstash yêu cầu kết nối bảo mật TLS (thường các gói Cloud cần)
//   tls: REDIS_URI.startsWith("rediss://") ? {} : undefined
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

//TIEEPS TỤC ĐƯA LÊN RENDER TEST VIDEOCALL