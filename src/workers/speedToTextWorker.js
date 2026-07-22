import { Worker } from "bullmq";
import { CALL_SERVICE } from "../service/call.service.js";
import { redisConnection } from "../queues/uploadFileQueue.js";

export const speedToTextWorker = new Worker(
    "speed-to-text-queue",
    async (job) => {
        const { callId, transcript, currentUserId } = job.data;

        try {
            await CALL_SERVICE.onSpeedToTextCall({
                callId,
                transcript,
                currentUserId
            });
        } catch (error) {
            console.error('SpeechToText Error in worker:', error);
        }
    }, {
        connection: redisConnection,
        concurrency: 5, // Số lượng job có thể xử lý đồng thời
        stalledInterval: 30000, // Kiểm tra job bị treo sau 30 giây
        drainDelay: 60
    }
);

speedToTextWorker.on("completed", (job) => {
    console.log(`SpeechToTextJob completed: ${job.id}`);
});

speedToTextWorker.on("failed", (job, error) => {
    console.error(`SpeechToTextJob failed: ${job?.id}`, error.message);
});