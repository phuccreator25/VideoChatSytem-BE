import { Worker } from "bullmq";
import { CHAT_SERVICE } from "../service/chat.service.js";
import { redisQueueConnection } from "../config/redis.js";

export const shareMessageWorker = new Worker(
    "share-message-queue",
    async (job) => {
        const { messageId, targetUserId, senderId, conversationId } = job.data;

        await CHAT_SERVICE.onForwardMessageSingle({
            messageId,
            targetUserId,
            senderId,
            conversationId
        });
    },
    {
        connection: redisQueueConnection,
        concurrency: 3,
        stalledInterval: 300000,
        drainDelay: 60,
    }
);
