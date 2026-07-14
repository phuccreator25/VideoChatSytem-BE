import { Worker } from "bullmq";
import { redisConnection } from "../queues/uploadFileQueue.js";
import { CHAT_SERVICE } from "../service/chat.service.js";

export const sendMessageWorker = new Worker(
  "send-message-queue",
  async (job) => {
    const { message, files, conversationId, currentUserId } = job.data;

    try {
      // Process message creation sequentially
      const result = await CHAT_SERVICE.processSendMessage({
        message,
        files: files || [],
        conversationId,
        currentUserId,
      });
      return result;
    } catch (error) {
      console.error("Error processing send message in worker:", error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Concurrency 1 guarantees sequential execution to avoid MongoDB write conflicts on conversation updates
  }
);

sendMessageWorker.on("completed", (job) => {
  console.log(`Send message job completed: ${job.id}`);
});

sendMessageWorker.on("failed", (job, error) => {
  console.error(`Send message job failed: ${job?.id}`, error.message);
});
