import { client } from "../../config/database.js";
import { CONVERSATION_REPOSITORY } from "../../repository/conversation.repository.js";
import { ObjectId } from "mongodb";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../../repository/conversationParticipant.repository.js";
import { MESSAGE_DELIVERY_REPOSITORY } from "../../repository/messageDeliveries.repository.js";
import { isUserOnline } from "../../sockets/socketStore.js";
import { MESSAGE_REPOSITORY } from "../../repository/message.repository.js";
import { emitNewMessages } from "../../sockets/emitters/messages.emitter.js";
import { fileUploadQueue, linkPreviewQueue, sendMessageQueue, sendMessageQueueEvents } from "../../queues/uploadFileQueue.js";

export const onSendMessage = async ({
  message,
  files,
  conversationId,
  currentUserId,
}) => {
  try {
    const job = await sendMessageQueue.add("send-message", {
      message,
      files,
      conversationId,
      currentUserId,
    });

    const result = await job.waitUntilFinished(sendMessageQueueEvents);
    return result;
  } catch (error) {
    console.error("Error adding send message job to queue:", error);
    throw error;
  }
};

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
    const hasFiles = files.length > 0;

    if (!content && !hasFiles && !hasGif) {
      throw new Error("Please enter the message content");
    }

    if (!conversationId) {
      throw new Error("Not found conversation.");
    }

    if (!currentUserId) {
      throw new Error("Your account does not exist");
    }

    session.startTransaction();

    const conversation = await CONVERSATION_REPOSITORY.findOne(
      {
        _id: new ObjectId(conversationId),
      },
      session,
    );

    if (!conversation) {
      throw new Error("Not found conversation.");
    }

    const currentParticipant =
      await CONVERSATION_PARTICIPANT_REPOSITORY.findOne(
        {
          conversationId,
          userId: currentUserId,
          leftAt: null,
        },
        session,
      );

    if (!currentParticipant) {
      throw new Error("You are not a participant of this conversation.");
    }

    const receiverParticipant =
      await CONVERSATION_PARTICIPANT_REPOSITORY.findOne(
        {
          conversationId,
          userId: { $ne: currentUserId },
          leftAt: null,
        },
        session,
      );

    if (!receiverParticipant) {
      throw new Error("Receiver not found.");
    }

    const now = new Date();
    const isOnlineReceiver = isUserOnline(receiverParticipant.userId);

    const normalizeArray = (value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const tempAttachmentIds = normalizeArray(message.tempAttachmentIds);

    const attachments = files.map((file, index) => ({
      attachmentId: new ObjectId().toString(),
      tempAttachmentId: tempAttachmentIds[index] || null,

      fileUrl: null,
      publicId: null,

      fileName: Buffer.from(file.originalname, "latin1").toString("utf8"),
      fileSize: file.size,
      mimeType: file.mimetype,

      resourceType: file.mimetype.startsWith("image/")
        ? "image"
        : file.mimetype.startsWith("audio/")
          ? "audio"
          : file.mimetype.startsWith("video/")
            ? "video"
            : "raw",

      status: "pending",

      recordDuration: file.mimetype.startsWith("audio/")
        ? Number(message.recordDuration)
        : null,

      createdAt: now,
      updatedAt: now,
    }));

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

    const messageType = hasFiles ? "file" : hasGif ? "gif" : "text";

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

    const messageCreated = await MESSAGE_REPOSITORY.createOne(
      messageCreate,
      session,
    );

    const messageId = messageCreated._id.toString();

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

    await CONVERSATION_REPOSITORY.updateOne(
      {
        _id: new ObjectId(conversationId),
      },
      {
        $set: {
          lastMessageId: messageId,
          lastMessageAt: now,
          updatedAt: now,
        },
      },
      session,
    );

    const createdMessage = await MESSAGE_REPOSITORY.findMessageAfterSend(
      messageCreated._id,
      session,
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
        },
      );
    }

    if (hasFiles) {
      const uploadItems = files.map((file, index) => ({
        file,
        attachment: attachments[index],
      }));

      const sortedUploadItems = uploadItems.sort(
        (a, b) => a.file.size - b.file.size,
      );

      const queueResults = await Promise.allSettled(
        sortedUploadItems.map(({ file, attachment }) => {
          return fileUploadQueue.add(
            "upload-message-attachment",
            {
              messageId,
              conversationId,

              tempMessageId: message.tempMessageId,
              tempAttachmentId: attachment.tempAttachmentId,

              senderId: currentUserId,
              receiverId: receiverParticipant.userId,

              attachmentId: attachment.attachmentId,

              fileName: Buffer.from(file.originalname, "latin1").toString(
                "utf8",
              ),
              fileSize: file.size,
              mimeType: file.mimetype,

              file: file.buffer,
            },
            {
              attempts: 3,
              backoff: {
                type: "exponential",
                delay: 3000,
              },
              removeOnComplete: true,
              removeOnFail: false,
            },
          );
        }),
      );

      for (let index = 0; index < queueResults.length; index++) {
        const result = queueResults[index];

        if (result.status === "rejected") {
          const { attachment } = sortedUploadItems[index];

          const failedAttachment =
            await MESSAGE_REPOSITORY.updateAttachmentStatus({
              messageId,
              attachmentId: attachment.attachmentId,
              status: "failed",
            });

          emitNewMessages(currentUserId, failedAttachment);
        }
      }
    }

    return createdMessage;
  } catch (error) {
    console.log("Error occurred while sending message:", message);
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

    const deliveries =
      await MESSAGE_DELIVERY_REPOSITORY.findMessageAndUpdateRead({
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
