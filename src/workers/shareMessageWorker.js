import { Worker } from "bullmq";
import { redisConnection } from "../queues/uploadFileQueue.js";
import { CHAT_SERVICE } from "../service/chat.service.js";

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
        connection: redisConnection,
        concurrency: 3,
        stalledInterval: 300000,
        drainDelay: 60,
    }
);
