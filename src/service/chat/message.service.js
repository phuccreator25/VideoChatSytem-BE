import { client } from "../../config/database.js";
import { CONVERSATION_REPOSITORY } from "../../repository/conversation.repository.js";
import { ObjectId } from "mongodb";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../../repository/conversationParticipant.repository.js";
import { MESSAGE_DELIVERY_REPOSITORY } from "../../repository/messageDeliveries.repository.js";
import { isUserOnline } from "../../sockets/socketStore.js";
import { MESSAGE_REPOSITORY } from "../../repository/message.repository.js";
import { emitNewMessages } from "../../sockets/emitters/messages.emitter.js";
import { linkPreviewQueue, sendMessageQueue, sendMessageQueueEvents } from "../../queues/uploadFileQueue.js";
import { BLOCK_REPOSITORY } from "../../repository/block.repository.js";
import { CONVERSATION_MODEL } from "../../models/conversation.model.js";
import { UPLOAD_SERVICE } from "../upload.service.js";
import { validateFileCount } from "../../validations/upload.validation.js";

const onSendMessageJob = async({ message, files, conversationId, currentUserId, isResend = false }) => {
  try {
    const otherUserId = await CONVERSATION_PARTICIPANT_REPOSITORY.findOtherUserIdByConversation(conversationId, currentUserId);
    
    const blockStatus = await BLOCK_REPOSITORY.findBlockStatusBetweenUsers(currentUserId, otherUserId);
    
    if (blockStatus.isBlockedByMe || blockStatus.isBlockedMe) {
      throw new Error("Cannot send message. Block status active between users.");
    }
    
    const jobPayload = {
      message: isResend ? { ...message, isResend: true } : message,
      files,
      conversationId,
      currentUserId,
    };
    
    const job = await sendMessageQueue.add("send-message", jobPayload);
   
    return await job.waitUntilFinished(sendMessageQueueEvents);
  
  } catch (error) {
    console.error(`Error adding ${isResend ? "resend" : "send"} message job to queue:`, error);
    throw error;
  }
}

const validateDataMessage = async ({ conversationId, currentUserId, session }) => {
  if (!conversationId) {
    throw new Error("Not found conversation.");
  }

  if (!currentUserId) {
    throw new Error("Your account does not exist");
  }

  const conversation = await CONVERSATION_REPOSITORY.findOne(
    { _id: new ObjectId(conversationId) },
    session
  );

  if (!conversation) {
    throw new Error("Not found conversation.");
  }

  const currentParticipant = await CONVERSATION_PARTICIPANT_REPOSITORY.findOne(
    { conversationId, userId: currentUserId, leftAt: null },
    session
  );

  if (!currentParticipant) {
    throw new Error("You are not a participant of this conversation.");
  }

  const receiverParticipant = await CONVERSATION_PARTICIPANT_REPOSITORY.findOne(
    { conversationId, userId: { $ne: currentUserId }, leftAt: null },
    session
  );

  if (!receiverParticipant) {
    throw new Error("Receiver not found.");
  }

  return { conversation, currentParticipant, receiverParticipant };
};

const buildAttachmentsPayload = (files, message, now) => {
  const tempAttachmentIds = (message?.tempAttachmentIds || [])
    .flat()
    .filter(Boolean);

  return (files || []).map((file, index) => {
    const mimeType = file.mimetype || file.mimeType || "";
    const fileName = file.originalname
      ? Buffer.from(file.originalname, "latin1").toString("utf8")
      : file.fileName;

    return {
      attachmentId: new ObjectId().toString(),
      tempAttachmentId: tempAttachmentIds[index] || file.tempAttachmentId || null,
      fileUrl: null,
      fileName,
      fileSize: file.size || file.fileSize || 0,
      mimeType,
      resourceType: file.resourceType || (mimeType.startsWith("image/")
        ? "image"
        : mimeType.startsWith("audio/")
          ? "audio"
          : mimeType.startsWith("video/")
            ? "video"
            : "raw"),
      status: "pending",
      recordDuration: mimeType.startsWith("audio/")
        ? Number(message?.recordDuration || file.recordDuration || 0)
        : null,
      createdAt: now,
      updatedAt: now,
    };
  });
};

const processResendMessageFlow = async ({
  existingMessage,
  message,
  files,
  attachments,
  currentUserId,
  session,
}) => {
  const pendingOrFailedTempIds = new Set();

  if (existingMessage.attachments?.length > 0) {
    existingMessage.attachments.forEach((att) => {
      if (att.status !== "done") {
        pendingOrFailedTempIds.add(att.tempAttachmentId);
      }
    });

    const updatedAttachments = existingMessage.attachments.map((att) =>
      att.status === "failed" ? { ...att, status: "pending" } : att
    );

    await MESSAGE_REPOSITORY.updateOne(
      { _id: existingMessage._id },
      { $set: { attachments: updatedAttachments } },
      session
    );
  }

  const createdMessage = await MESSAGE_REPOSITORY.findMessageAfterSend(
    existingMessage._id,
    session,
    currentUserId
  );
  createdMessage.tempMessageId = message.tempMessageId;

  if (session.inTransaction()) {
    await session.commitTransaction();
  }

  let presignedUrls = [];
  if (files.length > 0) {
    const filesPresign = attachments.filter((att) => pendingOrFailedTempIds.has(att.tempAttachmentId));
    if (filesPresign.length > 0) {
      presignedUrls = await UPLOAD_SERVICE.onPresignURL({
        files: filesPresign,
        type: "message",
      });
    }
  }

  return { ...createdMessage, presignedUrls };
};

const processNewMessage = async ({
  message,
  files,
  attachments,
  conversationId,
  currentUserId,
  receiverParticipant,
  now,
  session,
}) => {
  const content = message?.content?.trim() || "";
  const hasGif = message?.gifUrl;
  const hasFiles = files.length > 0;
  const messageType = hasFiles ? "file" : hasGif ? "gif" : "text";
  const isOnlineReceiver = isUserOnline(receiverParticipant.userId);

  const preview = message.preview
    ? {
      title: message.preview.title,
      description: message.preview.description,
      image: message.preview.image,
      url: message.preview.url,
      siteName: message.preview.siteName,
      domain: message.preview.domain,
    }
    : null;

  const messageCreate = {
    conversationId,
    senderId: currentUserId,
    type: messageType,
    content,
    gifUrl: messageType === "gif" ? message.gifUrl : null,
    attachments,
    preview,
    replyToMessageId: message.replyToMessageId ?? null,
    isEdited: false,
    editedAt: null,
    isRevoked: false,
    revokedAt: null,
    deletedBy: [],
    sendStatus: "sent",
    createdAt: now,
    updatedAt: now,
  };

  const messageCreated = await MESSAGE_REPOSITORY.createOne(messageCreate, session);
  const messageId = messageCreated._id.toString();

  if (message.type !== "file") {
    const messageDelivery = {
      messageId,
      userId: receiverParticipant.userId,
      deliveredAt: hasFiles ? null : isOnlineReceiver ? now : null,
      conversationId,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await MESSAGE_DELIVERY_REPOSITORY.createOne(messageDelivery, session);
  }

  await CONVERSATION_REPOSITORY.updateOne(
    { _id: new ObjectId(conversationId) },
    {
      $set: {
        lastMessageId: messageId,
        lastMessageAt: now,
        updatedAt: now,
        status: CONVERSATION_MODEL.conversationStatus.ACTIVE,
        deletedBy: [],
      },
    },
    session
  );

  const createdMessage = await MESSAGE_REPOSITORY.findMessageAfterSend(
    messageCreated._id,
    session,
    currentUserId
  );
  createdMessage.tempMessageId = message.tempMessageId;

  await session.commitTransaction();

  if (!hasFiles) {
    emitNewMessages(receiverParticipant.userId, createdMessage);
    emitNewMessages(currentUserId, createdMessage);
  }

  const URL_REGEX = /(https?:\/\/[^\s]+)/g;
  const match = content.match(URL_REGEX);

  if (match && match.length === 1 && messageType === "text" && !hasFiles && !hasGif) {
    const url = match[0];
    linkPreviewQueue.add(
      "get-link-preview",
      {
        messageId,
        url,
        currentUserId,
        ortherUserId: receiverParticipant.userId,
      },
      {
        attempts: 3,
        backoff: { delay: 1000, type: "exponential" },
      }
    );
  }

  let presignedUrls = [];
  if (hasFiles) {
    presignedUrls = await UPLOAD_SERVICE.onPresignURL({
      files: attachments,
      type: "message",
    });
  }

  return { ...createdMessage, presignedUrls };
};

export const onSendMessage = (payload) => onSendMessageJob(payload);

export const onResendMessage = (payload) => onSendMessageJob({ ...payload, isResend: true });

export const processSendMessage = async ({
  message,
  files,
  conversationId,
  currentUserId,
}) => {
  const session = client.startSession();

  try {
    const content = message?.content?.trim() || "";
    const hasGif = message?.gifUrl;
    const fileList = files || [];
    const hasFiles = fileList.length > 0;

    validateFileCount(fileList, "message");

    if (!content && !hasFiles && !hasGif) {
      throw new Error("Please enter the message content");
    }

    session.startTransaction();

    const { receiverParticipant } = await validateDataMessage({
      conversationId,
      currentUserId,
      session,
    });

    const now = new Date();
    const attachments = buildAttachmentsPayload(files, message, now);

    let existingMessage = null;

    if (message?.messageId) {
      existingMessage = await MESSAGE_REPOSITORY.findOne(
        { _id: new ObjectId(message.messageId) },
        session
      );
    }

    if (message?.isResend && !existingMessage) {
      throw new Error("Message not found to resend.");
    }

    if (existingMessage) {
      return await processResendMessageFlow({
        existingMessage,
        message,
        files,
        attachments,
        currentUserId,
        session,
      });
    }

    return await processNewMessage({
      message,
      files,
      attachments,
      conversationId,
      currentUserId,
      receiverParticipant,
      now,
      session,
    });
  } catch (error) {
    console.log("Error occurred while processing message:", message);
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export const markConversationAsRead = async ({ conversationId, currentUserId }) => {
  try {
    if (!conversationId || !currentUserId) {
      return {
        conversationId,
        readerUserId: currentUserId,
        readAt: null,
        updatedCount: 0,
        messageIds: [],
        senderIds: [],
      };
    }

    const deliveries = await MESSAGE_DELIVERY_REPOSITORY.findMessageAndUpdateRead({
      conversationId,
      currentUserId,
    });

    const readAt = deliveries[0]?.readAt || null;

    return {
      conversationId,
      readerUserId: currentUserId,
      readAt,
      updatedCount: deliveries.length,
      messageIds: deliveries.map((item) => item.messageId),
      senderId: deliveries[0]?.senderId,
    };
  } catch (error) {
    throw error;
  }
};
