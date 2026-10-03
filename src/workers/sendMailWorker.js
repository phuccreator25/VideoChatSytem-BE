import { Worker } from "bullmq";
import { redisQueueConnection } from "../config/redis.js";
import { sendMail } from "../config/sendMail.js";

export const sendMailWorker = new Worker(
  "send-mail-queue",
  async (job) => {
    const { to, title, view, data } = job.data;

    try {
      await sendMail({ to, title, view, data });
    } catch (error) {
      console.error("Error processing send message in worker:", error);
      throw error;
    }
  },
  {
    connection: redisQueueConnection,
    concurrency: 1,
    stalledInterval: 300000,
    drainDelay: 60,
  }
);

sendMailWorker.on("completed", (job) => {
  console.log(`Send mail job completed: ${job.id}`);
});

sendMailWorker.on("failed", (job, error) => {
  console.error(`Send mail job failed: ${job?.id}`, error.message);
});
