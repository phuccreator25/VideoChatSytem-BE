import { Queue } from "bullmq";
import IORedis from "ioredis";
import env from "../config/env.js";

export const redisConnection = new IORedis({
  host: env.REDIS_HOST || "http://localhost:5173",
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