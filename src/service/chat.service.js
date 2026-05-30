import { client } from "../config/database.js";
import { CONVERSATION_REPOSITORY } from "../repository/conversation.repository.js";
import { ObjectId } from "mongodb";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../repository/conversationParticipant.repository.js";
import { MESSAGE_DELIVERY_REPOSITORY } from "../repository/messageDeliveries.repository.js";
import { isUserOnline } from "../sockets/socketStore.js";
import { MESSAGE_REPOSITORY } from "../repository/message.repository.js";
import { emitNewMessages } from "../sockets/emitters/messages.emitter.js";

const onSendMessage = async ({ message, conversationId, currentUserId }) => {
  const session = client.startSession();

  try {
    if (!message?.content?.trim()) {
      throw new Error("Please enter the message content.");
    }

    if (!conversationId) {
      throw new Error("Not found conversationId.");
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

    const messageCreate = {
      conversationId,
      senderId: currentUserId,
      type: message.type,
      content: message.content.trim(),
      fileUrl: null,
      fileName: null,
      fileSize: null,
      replyToMessageId: null,
      isEdited: false,
      editedAt: null,
      isDeleted: false,
      deletedAt: null,
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
      deliveredAt: isOnlineReceiver ? now : null,
      conversationId,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await MESSAGE_DELIVERY_REPOSITORY.createOne(
      messageDelivery,
      session,
    );

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

    await session.commitTransaction();

    emitNewMessages(receiverParticipant.userId, createdMessage)
    emitNewMessages(currentUserId, createdMessage)
    
    return createdMessage;
  } catch (error) {
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

    const deliveries = await MESSAGE_DELIVERY_REPOSITORY.findMessageAndUpdateRead({
      conversationId,
      currentUserId,
    });

    if(deliveries.length === 0) throw new Error("No messages to mark as read");

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


export const CHAT_SERVICE = {
  onSendMessage, markConversationAsRead
};
