import { Worker } from "bullmq";
import { MESSAGE_REPOSITORY } from "../repository/message.repository.js";
import { uploadBufferToCloudinary } from "../helper/uploadBuffer.js";
import { redisConnection } from "../queues/uploadFileQueue.js";
import { emitNewMessages } from "../sockets/emitters/messages.emitter.js";
import { MESSAGE_DELIVERY_REPOSITORY } from "../repository/messageDeliveries.repository.js";
import { isUserOnline } from "../sockets/socketStore.js";

const getCloudinaryOptions = (mimeType, fileName) => {
  const lowerMime = (mimeType || "").toLowerCase();
  const lowerName = (fileName || "").toLowerCase();

  const isImage =
    lowerMime.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(lowerName);

  const isVideo =
    lowerMime.startsWith("video/") ||
    /\.(mp4|webm|mov|avi|mkv)$/i.test(lowerName);

  const isAudio =
    lowerMime.startsWith("audio/") ||
    /\.(mp3|wav|ogg|m4a|aac)$/i.test(lowerName);

  if (isImage) {
    return {
      resource_type: "image",
      format: "webp",
      quality: "auto",
    };
  }

  if (isVideo || isAudio) {
    return {
      resource_type: "video",
    };
  }

  return {
    resource_type: "raw",
  };
};

export const fileUploadWorker = new Worker(
  "file-upload-queue", // Phải trùng với tên queue đã tạo
  async (job) => {
    const {
      messageId,
      conversationId,
      attachmentId,
      tempMessageId,
      tempAttachmentId,
      senderId,
      receiverId,
      file,
      fileName,
      mimeType,
    } = job.data;

    try {
      await MESSAGE_REPOSITORY.updateAttachmentStatus({
        messageId,
        attachmentId,
        status: "uploading",
      });

      const normalizedBuffer = Buffer.isBuffer(file)
        ? file
        : Buffer.from(file.data);

      const cloudinaryOptions = getCloudinaryOptions(mimeType, fileName);

      const upload = await uploadBufferToCloudinary(normalizedBuffer, {
        folder: "Chat_System_Attachments",
        public_id: `${messageId}-${attachmentId}`,
        ...cloudinaryOptions,
      });

      await MESSAGE_REPOSITORY.updateAttachmentAfterUpload({
        messageId,
        attachmentId,
        fileUrl: upload.secure_url,
        publicId: upload.public_id,
      });

      let updatedMessage =
        await MESSAGE_REPOSITORY.findMessageAfterSend(messageId);

      updatedMessage.tempMessageId = tempMessageId;

      const index = updatedMessage.attachments.findIndex(
        (att) => att.attachmentId === attachmentId,
      );

      if (index !== -1) {
        updatedMessage.attachments[index].tempAttachmentId = tempAttachmentId;
      }

      const hasAnyDone = updatedMessage.attachments.some(
        (attachment) => attachment.status === "done",
      );
      const receiverAttachments = updatedMessage.attachments.filter(
        (attachment) => attachment.status === "done",
      );

      emitNewMessages(senderId, updatedMessage);

      if (hasAnyDone && receiverAttachments.length > 0) {
        const isOnlineReceiver = isUserOnline(receiverId);

        if (isOnlineReceiver) {
          const now = new Date();

          await MESSAGE_DELIVERY_REPOSITORY.updateOne(
            {
              messageId,
              userId: receiverId,
              deliveredAt: null,
            },
            {
              $set: {
                deliveredAt: now,
                updatedAt: now,
              },
            },
          );

          updatedMessage =
            await MESSAGE_REPOSITORY.findMessageAfterSend(messageId);

          updatedMessage.tempMessageId = tempMessageId;
        }

        emitNewMessages(receiverId, {
          ...updatedMessage,
          attachments: updatedMessage.attachments.filter(
            (attachment) => attachment.status === "done",
          ),
        });
      }

      return updatedMessage;
    } catch (error) {
      console.log("Upload attachment failed:", {
        messageId,
        attachmentId,
        fileName,
        mimeType,
        error: error.message,
      });

      await MESSAGE_REPOSITORY.updateAttachmentStatus({
        conversationId,
        messageId,
        attachmentId,
        status: "failed",
      });

      const failedMessage =
        await MESSAGE_REPOSITORY.findMessageAfterSend(messageId);

      failedMessage.tempMessageId = tempMessageId; // Gắn tempMessageId vào message trả về để cập nhật đúng message khi trả về trạng thái
      failedMessage.tempAttachmentId = tempAttachmentId; // Gắn tempAttachmentId vào message trả về để cập nhật đúng attachment khi trả về trạng thái

      emitNewMessages(senderId, failedMessage);

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
    stalledInterval: 300000, // Check for stalled jobs every 5 minutes (reduces Upstash requests)
    drainDelay: 60,          // Wait 60 seconds when queue is empty before polling again
  },
);

fileUploadWorker.on("completed", (job) => {
  console.log(`File upload job completed: ${job.id}`);
});

fileUploadWorker.on("failed", (job, error) => {
  console.log(`File upload job failed: ${job?.id}`, error.message);
});
