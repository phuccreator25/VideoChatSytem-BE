import { Worker } from "bullmq";
import { ObjectId } from "mongodb";
import { emitUpdateLinkPreview } from "../sockets/emitters/messages.emitter.js";
import { MESSAGE_REPOSITORY } from "../repository/message.repository.js";
import { redisConnection } from "../queues/uploadFileQueue.js";
import { CHAT_SERVICE } from "../service/chat.service.js";

export const getLinkPeviewWorker = new Worker(
    "link-preview-queue",
    async (job) => {
        const { url, messageId, currentUserId, ortherUserId } = job.data;
        const result = await CHAT_SERVICE.onGetLinkPreview({ url });

        if (result) {
            await MESSAGE_REPOSITORY.updateOne(
                { _id: new ObjectId(messageId) },
                { $set: { preview: result } }
            );

            const updatedMessage = await MESSAGE_REPOSITORY.findMessageAfterSend(messageId);

            if (updatedMessage) {
                emitUpdateLinkPreview(currentUserId, updatedMessage);
                emitUpdateLinkPreview(ortherUserId, updatedMessage);
            }
        }
    },
    {
        connection: redisConnection,
        concurrency: 3,
    }
);