import { Queue } from "bullmq";
import IORedis from "ioredis";
import env from "../config/env.js";

export const redisConnection = new IORedis({
  host: env.REDIS_HOST || "http://localhost:5173",
  port: Number(env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
});

export const fileUploadQueue = new Queue("file-upload-queue", {
  connection: redisConnection,
});

export const shareMessageQueue = new Queue("share-message-queue", {
  connection: redisConnection,
});