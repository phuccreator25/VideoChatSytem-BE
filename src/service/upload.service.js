import { ObjectId } from "mongodb";
import { UPLOAD_S3 } from "../helper/uploadS3.js";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../repository/conversationParticipant.repository.js";
import { MESSAGE_REPOSITORY } from "../repository/message.repository.js";
import { MESSAGE_DELIVERY_REPOSITORY } from "../repository/messageDeliveries.repository.js";
import { emitNewMessages } from "../sockets/emitters/messages.emitter.js";
import { validateUploadFile, validateFileCount } from "../validations/upload.validation.js";
import { isUserOnline } from "../sockets/socketStore.js";
import { CHUNK_SIZE } from "../data/upload.data.js";

const onPresignURL = async ({ files, type = "message", userId = null }) => {
  if (type !== "message" && type !== "avatar") {
    throw new Error("Invalid upload type");
  }

  const fileList = Array.isArray(files)
    ? files
    : (files && typeof files === "object" ? [files] : []);

  validateFileCount(fileList, type);

  const presignUrls = await Promise.all(
    fileList.map(async (file) => {
      validateUploadFile(file, type);

      const tempId = file.tempAttachmentId;
      const size = Number(file.fileSize || 0);

      if (size < CHUNK_SIZE) {
        const result = await UPLOAD_S3.onGeneratePresignURL({
          folder: type === "message" ? "messageFiles" : "avatars",
          userId,
          tempAttachmentId: tempId,
          filename: file.fileName,
          mimeType: file.mimeType,
        });

        return {
          uploadType: "single",
          tempAttachmentId: tempId,
          s3Key: result.s3Key || result.fileName,
          originalFileName: file.fileName,
          mimeType: file.mimeType,
          presignedUrl: result.url,
        };
      }

      const multiResult = await UPLOAD_S3.onGenerateMultiPartUploadURL({
        folder: type === "message" ? "messageFiles" : "avatars",
        userId,
        tempAttachmentId: tempId,
        filename: file.fileName,
        mimeType: file.mimeType,
      });

      const totalParts = Math.ceil(size / CHUNK_SIZE);

      const parts = [];
        for (let i = 1; i <= totalParts; i++) {
          const partNumber = i;
          const result = await UPLOAD_S3.onGeneratePartPresignedURL({
            s3Key: multiResult.s3Key,
            uploadId: multiResult.uploadId,
            partNumber,
          });
          parts.push({
            partNumber,
            presignedUrl: result.url || result.presignedUrl,
          });
        }

      return {
        uploadType: "multipart",
        tempAttachmentId: tempId,
        s3Key: multiResult.s3Key,
        uploadId: multiResult.uploadId,
        originalFileName: file.fileName,
        mimeType: file.mimeType,
        parts,
        totalParts,
      };

    })
  );

  return presignUrls;
};

const onUpdateStatus = async ({
  messageId,
  tempMessageId,
  successAttachmentIds = [],
  failedAttachmentIds = [],
}) => {
  try {

    const currentMsg = await MESSAGE_REPOSITORY.findOne({
      _id: new ObjectId(messageId),
    });

    if (!currentMsg) {
      throw new Error("Message not found.");
    }

    const currentMsgAttachments = currentMsg.attachments;

    if (successAttachmentIds.length > 0) {
      await Promise.all(
        successAttachmentIds.map(async (tempAttachmentId) => {
          const att = currentMsgAttachments.find(a => a.tempAttachmentId === tempAttachmentId);
          return MESSAGE_REPOSITORY.updateAttachmentStatusByTempId({
            messageId,
            tempAttachmentId,
            status: "done",
            fileUrl: await UPLOAD_S3.onGetURL("message", null, att?.tempAttachmentId, att?.fileName)
          });
        })
      );
    }

    if (failedAttachmentIds.length > 0) {
      await Promise.all(
        failedAttachmentIds.map(async (tempAttachmentId) => {
          const att = currentMsgAttachments.find(a => a.tempAttachmentId === tempAttachmentId);
          return MESSAGE_REPOSITORY.updateAttachmentStatusByTempId({
            messageId,
            tempAttachmentId,
            status: "failed",
            fileUrl: null,
          });
        })
      );
    }

    const updatedMessage = await MESSAGE_REPOSITORY.findMessageAfterSend(
      messageId,
      null,
      currentMsg.senderId
    );
    
    if (!updatedMessage) return null;

    if (tempMessageId) {
      updatedMessage.tempMessageId = tempMessageId;
    }

    const receiverParticipant =
      await CONVERSATION_PARTICIPANT_REPOSITORY.findOne({
        conversationId: updatedMessage.conversationId,
        userId: { $ne: updatedMessage.senderId },
        leftAt: null,
      });

    const receiverId = receiverParticipant?.userId;

    const doneAttachments = updatedMessage.attachments.filter(
      (att) => att.status === "done"
    );

    if (receiverId && doneAttachments.length > 0) {
      const now = new Date();
      const existingDelivery = await MESSAGE_DELIVERY_REPOSITORY.findOne({
        messageId,
        userId: receiverId,
      });

      if (!existingDelivery) {
        await MESSAGE_DELIVERY_REPOSITORY.createOne({
          messageId,
          userId: receiverId,
          conversationId: updatedMessage.conversationId,
          deliveredAt: isUserOnline(receiverId) ? now : null,
          readAt: null,
          createdAt: now,
          updatedAt: now,
        });
      } else if (isUserOnline(receiverId) && !existingDelivery.deliveredAt) {
        await MESSAGE_DELIVERY_REPOSITORY.updateOne(
          { messageId, userId: receiverId, deliveredAt: null },
          { $set: { deliveredAt: now, updatedAt: now } }
        );
      }
    }

    emitNewMessages(updatedMessage.senderId, updatedMessage);

    if (receiverId && doneAttachments.length > 0) {
      emitNewMessages(receiverId, {
        ...updatedMessage,
        attachments: doneAttachments,
      });
    }

    return updatedMessage;
  } catch (error) {
    console.error("Error updating attachment status:", error);
    throw error;
  }
};

const onCompleteMultipart = async ({ uploadId, s3Key, parts }) => {
  try {
    const result = await UPLOAD_S3.onCompleteMultipart({ uploadId, s3Key, parts });
    return result;
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    throw error;
  }
};

const onCancelBeacon = async ({ failedAttachmentIds = [] }) => {
  if (failedAttachmentIds.length > 0) {
    await Promise.all(
      failedAttachmentIds.map((tempAttachmentId) =>
        MESSAGE_REPOSITORY.updateAttachmentStatusByTempId({
          tempAttachmentId,
          status: "failed",
          fileUrl: null,
        })
      )
    );
  }
};

export const UPLOAD_SERVICE = {
  onPresignURL,
  onUpdateStatus,
  onCompleteMultipart,
  onCancelBeacon,
};
