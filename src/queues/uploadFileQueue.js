import { Queue, QueueEvents } from "bullmq";
import { redisQueueConnection } from "../config/redis.js";

const defaultQueueOptions = {
  connection: redisQueueConnection,
  defaultJobOptions: {
    removeOnComplete: true, // Xóa ngay khi thành công để nhẹ RAM/Ổ cứng
    removeOnFail: 10,      // Chỉ giữ lại tối đa 10 job lỗi để kiểm tra
  }
};

export const fileUploadQueue = new Queue("file-upload-queue", defaultQueueOptions);
export const shareMessageQueue = new Queue("share-message-queue", defaultQueueOptions);
export const linkPreviewQueue = new Queue("link-preview-queue", defaultQueueOptions);
export const sendMessageQueue = new Queue("send-message-queue", defaultQueueOptions);
export const sendMessageQueueEvents = new QueueEvents("send-message-queue", { connection: redisQueueConnection });
export const speedToTextQueue = new Queue("speed-to-text-queue", defaultQueueOptions);
