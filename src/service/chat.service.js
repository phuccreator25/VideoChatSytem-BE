import { client } from "../config/database.js";
import { CONVERSATION_REPOSITORY } from "../repository/conversation.repository.js";
import { ObjectId } from "mongodb";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../repository/conversationParticipant.repository.js";
import { MESSAGE_DELIVERY_REPOSITORY } from "../repository/messageDeliveries.repository.js";
import { isUserOnline } from "../sockets/socketStore.js";
import { MESSAGE_REPOSITORY } from "../repository/message.repository.js";
import {
  emitDeleteMessage,
  emitNewMessages,
  emitReactEmotion,
  emitUnReactEmotion,
  emitRevokeMessage,
} from "../sockets/emitters/messages.emitter.js";
import { fileUploadQueue, shareMessageQueue } from "../queues/uploadFileQueue.js";
import { MESSAGE_REACTION_REPOSITORY } from "../repository/messageReaction.repository.js";

const onSendMessage = async ({
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
      // Trahs việc 1 ảnh thì không dùng Array cho tempID
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const tempAttachmentIds = normalizeArray(message.tempAttachmentIds);

    const attachments = files.map((file, index) => ({
      attachmentId: new ObjectId().toString(),
      tempAttachmentId: tempAttachmentIds[index] || null, // Truyền tempAttachmentId từ payload vào attachment để cập nhật đúng attachment khi trả về trạng thái

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

    const messageType = hasFiles ? "file" : hasGif ? "gif" : "text";

    const messageCreate = {
      conversationId,
      senderId: currentUserId,

      type: messageType,
      content,
      gifUrl: messageType === "gif" ? message.gifUrl : null,

      attachments,

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
      deliveredAt: hasFiles ? null : isOnlineReceiver ? now : null, //Nếu là file thì chờ update ở worker
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

    createdMessage.tempMessageId = message.tempMessageId; // Gán tempMessageId từ payload vào message trả về

    await session.commitTransaction();

    if (!hasFiles) {
      emitNewMessages(receiverParticipant.userId, createdMessage);
      emitNewMessages(currentUserId, createdMessage);
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
    //Xử lý message gửi lỗi
    console.log("lõi: ", error);

    console.log("Error occurred while sending message:", message);

    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const markConversationAsRead = async ({ conversationId, currentUserId }) => {
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

const onReactEmotion = async ({
  conversationId,
  messageId,
  currentUserId,
  emotionPayload,
}) => {
  const session = client.startSession();

  try {
    if (!conversationId || !messageId || !currentUserId || !emotionPayload)
      return;

    session.startTransaction();

    const conversation = await CONVERSATION_REPOSITORY.findOne(
      { _id: new ObjectId(conversationId), status: "active" },
      session,
    );
    if (!conversation) throw new Error("Not found conversation");

    const ortherUserId = await CONVERSATION_PARTICIPANT_REPOSITORY.findOtherUserIdByConversation(
      conversationId,
      currentUserId,
    );
    if (!ortherUserId) throw new Error("You are not allowed to operate.");

    const message = await MESSAGE_REPOSITORY.findOne(
      { _id: new ObjectId(messageId), deletedBy: { $nin: [currentUserId] }, isRevoked: false },
      session,
    );
    if (!message) throw new Error("Not found message");

    const isEmotion = await MESSAGE_REACTION_REPOSITORY.findOne(
      { messageId, userId: currentUserId },
      session,
    );

    if (isEmotion) {
      await MESSAGE_REACTION_REPOSITORY.updateOne(
        { messageId, userId: currentUserId },
        {
          emotion: emotionPayload.emotion,
        },
        session,
      );
    } else {
      await MESSAGE_REACTION_REPOSITORY.createOne(
        { messageId, userId: currentUserId, emotion: emotionPayload.emotion },
        session,
      );
    }

    await session.commitTransaction();

    const reactionsForSender = await MESSAGE_REACTION_REPOSITORY.findByMessageWithUserName({
      messageId,
      currentUserId: currentUserId,
    });

    emitReactEmotion(currentUserId, {
      messageId,
      reactions: reactionsForSender,
    });

    const reactionsForReceiver = await MESSAGE_REACTION_REPOSITORY.findByMessageWithUserName({
      messageId,
      currentUserId: ortherUserId,
    });

    emitReactEmotion(ortherUserId, {
      messageId,
      reactions: reactionsForReceiver,
    });

    return {
      messageId,
      reactions: reactionsForSender,
    };

  } catch (error) {
    throw error;
  } finally {
    session.endSession();
  }
};

const onUnReactEmotion = async ({
  conversationId,
  messageId,
  currentUserId,
}) => {
  const session = client.startSession();

  try {
    if (!conversationId || !messageId || !currentUserId)
      return;

    session.startTransaction();

    const conversation = await CONVERSATION_REPOSITORY.findOne(
      { _id: new ObjectId(conversationId), status: "active" },
      session,
    );
    if (!conversation) throw new Error("Not found conversation");

    const ortherUserId = await CONVERSATION_PARTICIPANT_REPOSITORY.findOtherUserIdByConversation(
      conversationId,
      currentUserId,
    );
    if (!ortherUserId) throw new Error("You are not allowed to operate.");

    const message = await MESSAGE_REPOSITORY.findOne(
      { _id: new ObjectId(messageId), deletedBy: { $nin: [currentUserId] }, isRevoked: false },
      session,
    );
    if (!message) throw new Error("Not found message");

    const isUnReactEmotion = await MESSAGE_REACTION_REPOSITORY.findOne(
      { messageId, userId: currentUserId },
      session,
    );
    if (!isUnReactEmotion) throw new Error("Not found react emotion");

    await MESSAGE_REACTION_REPOSITORY.deleteOne(
      { messageId, userId: currentUserId },
      session,
    );

    await session.commitTransaction();

    const reactionsForSender = await MESSAGE_REACTION_REPOSITORY.findByMessageWithUserName({
      messageId,
      currentUserId: currentUserId,
    });
    console.log(reactionsForSender);
    emitUnReactEmotion(currentUserId, {
      messageId,
      reactions: reactionsForSender,
    });

    const reactionsForReceiver = await MESSAGE_REACTION_REPOSITORY.findByMessageWithUserName({
      messageId,
      currentUserId: ortherUserId,
    });

    console.log(reactionsForReceiver);
    emitUnReactEmotion(ortherUserId, {
      messageId,
      reactions: reactionsForReceiver,
    });

    return {
      messageId,
      reactions: reactionsForSender,
    };

  } catch (error) {
    throw error;
  } finally {
    session.endSession();
  }
};

const onForwardMessageSingle = async ({ messageId, targetUserId, senderId, conversationId }) => {
  const session = client.startSession();
  try {
    session.startTransaction();

    const message = await MESSAGE_REPOSITORY.findOne({
      _id: new ObjectId(messageId),
      deletedBy: {
        $nin: [senderId],
      },
      isRevoked: false
    }, session);

    if (!message) throw new Error("Message not found");

    let finalConversationId = conversationId;

    //Tạo mới conversation
    if (!finalConversationId) {
      const conversation = await CONVERSATION_REPOSITORY.findConversationBetweenUser(senderId, targetUserId);

      if (conversation) {

        finalConversationId = conversation._id.toString();

      } else {

        const newConversation = await CONVERSATION_REPOSITORY.createOne({
          type: "direct",
          created_by: senderId,
          createdAt: new Date(),
        }, session);

        finalConversationId = newConversation._id.toString();

        await CONVERSATION_PARTICIPANT_REPOSITORY.createOne({
          conversationId: finalConversationId,
          userId: senderId,
        }, session);

        await CONVERSATION_PARTICIPANT_REPOSITORY.createOne({
          conversationId: finalConversationId,
          userId: targetUserId,
        }, session);
      }
    }

    const now = new Date();

    // 3. Sao chép danh sách attachments (nếu có)
    const clonedAttachments = (message.attachments || []).map(att => ({
      attachmentId: new ObjectId().toString(), // Tạo ID mới
      tempAttachmentId: null,
      fileUrl: att.fileUrl,
      publicId: att.publicId,
      fileName: att.fileName,
      fileSize: att.fileSize,
      mimeType: att.mimeType,
      resourceType: att.resourceType,
      status: "done",
      createdAt: now,
      updatedAt: now
    }));

    // 4. Tạo tin nhắn mới
    const messageData = {
      conversationId: finalConversationId,
      senderId,
      type: message.type,
      content: message.content,
      gifUrl: message.gifUrl,
      attachments: clonedAttachments,
      replyToMessageId: null,
      isEdited: false,
      isRevoked: false,
      deletedBy: [],
      sendStatus: "sent",
      createdAt: now,
      updatedAt: now
    };

    const messageCreated = await MESSAGE_REPOSITORY.createOne(messageData, session);
    const newMsgId = messageCreated._id.toString();

    // Tạo message Delivery
    const isOnlineReceiver = isUserOnline(targetUserId);
    const messageDelivery = {
      messageId: newMsgId,
      userId: targetUserId,
      deliveredAt: isOnlineReceiver ? now : null,
      conversationId: finalConversationId,
      readAt: null,
      createdAt: now,
      updatedAt: now
    };

    await MESSAGE_DELIVERY_REPOSITORY.createOne(messageDelivery, session);

    // Cập nhật lại cho conversation
    await CONVERSATION_REPOSITORY.updateOne(
      { _id: new ObjectId(finalConversationId) },
      {
        $set: {
          lastMessageId: newMsgId,
          lastMessageAt: now,
          updatedAt: now
        }
      },
      session
    );

    const createdMessage = await MESSAGE_REPOSITORY.findMessageAfterSend(newMsgId, session);

    await session.commitTransaction();

    emitNewMessages(targetUserId, createdMessage);
    emitNewMessages(senderId, createdMessage);

    return createdMessage;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const onForwardMessage = async ({ selectedIds, messageId, senderId }) => {
  try {
    if (!selectedIds || !messageId || !senderId) return;

    console.log("🚀 ~ chat.service.js:608 ~ onForwardMessage ~ senderId:", senderId);
    console.log("🚀 ~ chat.service.js:608 ~ onForwardMessage ~ messageId:", messageId);
    console.log("🚀 ~ chat.service.js:608 ~ onForwardMessage ~ selectedIds:", selectedIds);


    const messageQueues = await Promise.allSettled(
      selectedIds.map(async (selectedId) => {

        let targetUserId = null;
        let conversationId = null;

        if (selectedId.startsWith("contact-")) {
          targetUserId = selectedId.replace("contact-", "");
        } else {
          conversationId = selectedId;

          const otherParticipant = await CONVERSATION_PARTICIPANT_REPOSITORY.findOne({
            conversationId,
            userId: { $ne: senderId },
            leftAt: null,
          });

          if (otherParticipant) {
            targetUserId = otherParticipant.userId;
          }
        }

        if (!targetUserId) {
          throw new Error(`Cannot find recipient for target: ${selectedId}`);
        }

        return shareMessageQueue.add(
          "forward-message",
          {
            messageId,
            targetUserId,
            senderId,
            conversationId,
          },
          {
            attempts: 3,
            backoff: { delay: 1000, type: "exponential" },
          },
        );
      })
    );

    return messageQueues;
  } catch (error) {
    throw error;
  }
};

const onDeleteMessage = async ({ conversationId, messageId, currentUserId }) => {
  const session = client.startSession();
  try {
    session.startTransaction();

    const conversation = await CONVERSATION_REPOSITORY.findOne({ _id: new ObjectId(conversationId) }, session);
    if (!conversation) throw new Error("Not found conversation");

    const message = await MESSAGE_REPOSITORY.findOne({ _id: new ObjectId(messageId) }, session);
    if (!message) throw new Error("Not found message");

    await MESSAGE_REPOSITORY.updateOne(
      { _id: new ObjectId(messageId) },
      {
        $push: {
          deletedBy: currentUserId,
        },
      },
      session,
    );

    await session.commitTransaction();

    const messageDeleted = {
      id: message._id.toString(),
      conversationId: message.conversationId,
    };

    emitDeleteMessage(currentUserId, messageDeleted);

    return messageDeleted;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const onRevokeMessage = async ({ conversationId, messageId, currentUserId }) => {
  const session = client.startSession();
  try {
    session.startTransaction();

    const conversation = await CONVERSATION_REPOSITORY.findOne({ _id: new ObjectId(conversationId) }, session);
    if (!conversation) throw new Error("Not found conversation");

    const message = await MESSAGE_REPOSITORY.findOne({ _id: new ObjectId(messageId) }, session);
    if (!message) throw new Error("Not found message");

    if (message.senderId !== currentUserId) throw new Error("You are not the sender of this message");

    if (message.isRevoked) throw new Error("Message has already been revoked");

    await MESSAGE_REPOSITORY.updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      },
      session,
    );

    const ortherUserId = await CONVERSATION_PARTICIPANT_REPOSITORY.findOtherUserIdByConversation(
      conversationId,
      currentUserId,
    );

    const messageRevoked = {
      id: message._id.toString(),
      conversationId: message.conversationId,
    };

    await session.commitTransaction();

    emitRevokeMessage(currentUserId, messageRevoked);
    emitRevokeMessage(ortherUserId, messageRevoked);

    return messageRevoked;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
};

export const CHAT_SERVICE = {
  onSendMessage,
  markConversationAsRead,
  onReactEmotion,
  onUnReactEmotion,
  onForwardMessageSingle,
  onForwardMessage,
  onDeleteMessage,
  onRevokeMessage,
};
