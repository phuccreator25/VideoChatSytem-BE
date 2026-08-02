import { ObjectId } from "mongodb";
import { CONTACTS_REPOSITORY } from "../repository/contacts.repository.js";
import { CONVERSATION_REPOSITORY } from "../repository/conversation.repository.js";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../repository/conversationParticipant.repository.js";
import { MESSAGE_REPOSITORY } from "../repository/message.repository.js";
import { USER_REPOSITORY } from "../repository/user.repository.js";
import { client } from "../config/database.js";
import { isUserOnline } from "../sockets/socketStore.js";
import { INVITATION_REPOSITORY } from "../repository/invitation.repository.js";
import {
  emitDeletePinMessages,
  emitPinMessages,
} from "../sockets/emitters/messages.emitter.js";
import { BLOCK_REPOSITORY } from "../repository/block.repository.js";

const onGetOrCreateConversation = async ({ currentUserId, userId }) => {
  if (!currentUserId || !userId)
    throw new Error("UserID or CurrentUserId are required");
  if (String(currentUserId) === String(userId)) {
    throw new Error("Cannot create conversation with yourself");
  }

  const conversation =
    await CONVERSATION_REPOSITORY.findConversationBetweenUser(
      currentUserId,
      userId,
    );

  if (conversation) return conversation;

  const newConversationData = {
    type: "direct",
    created_by: currentUserId,
    createdAt: new Date(),
  };

  const session = client.startSession();

  try {
    session.startTransaction();

    const newConversation = await CONVERSATION_REPOSITORY.createOne(
      newConversationData,
      session,
    );

    await CONVERSATION_PARTICIPANT_REPOSITORY.createOne(
      {
        conversationId: newConversation._id.toString(),
        userId: currentUserId,
      },
      session,
    );

    await CONVERSATION_PARTICIPANT_REPOSITORY.createOne(
      {
        conversationId: newConversation._id.toString(),
        userId: userId,
      },
      session,
    );

    await session.commitTransaction();
    return newConversation;
  } catch (error) {
    console.log(error);

    await session.endSession();
    throw error;
  } finally {
    await session.endSession();
  }
};

const onGetConversationById = async ({ conversationId, currentUserId }) => {
  if (!conversationId) throw new Error("Conversation ID is required");

  const conversation = await CONVERSATION_REPOSITORY.findOne({
    _id: new ObjectId(conversationId),
    status: "active",
  });

  if (!conversation) throw new Error("Conversation not found");

  const otherUserId =
    await CONVERSATION_PARTICIPANT_REPOSITORY.findOtherUserIdByConversation(
      conversationId.toString(),
      currentUserId.toString(),
    );

  if (!otherUserId) {
    throw new Error("You are not a participant of this conversation");
  }

  const [userData, contactData, messages, Invitation, pinMessages, block] = await Promise.all([
    USER_REPOSITORY.findById(otherUserId),
    CONTACTS_REPOSITORY.findContactItem(currentUserId, otherUserId),
    MESSAGE_REPOSITORY.findByConversationId(conversationId, currentUserId, {
      limit: 30,
      sort: { createdAt: -1 },
    }),
    INVITATION_REPOSITORY.findByFilter({
      status: "pending",
      $or: [
        {
          senderId: currentUserId,
          receiverId: otherUserId,
        },
        {
          senderId: otherUserId,
          receiverId: currentUserId,
        },
      ],
    }),
    CONVERSATION_REPOSITORY.findManyPinMessages(conversationId, currentUserId),
    BLOCK_REPOSITORY.findBlockStatusBetweenUsers(currentUserId, otherUserId)
  ]);

  if (!userData) {
    throw new Error("User not found");
  }

  return {
    conversation: {
      _id: conversation._id,
      type: conversation.type,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt,
      lastMessageId: conversation.lastMessageId,
      block: {
        userId: otherUserId,
        isBlockedByMe: block.isBlockedByMe,
        isBlockedMe: block.isBlockedMe,
      },
      pinMessages,
    },
    user: {
      userId: userData._id,
      avatar: userData.avatar,
      fullname: userData.fullname,
      nickname: contactData?.nickname || null,
      isOnline: isUserOnline(userData._id) ? "online" : "offline",
      lastSeenAt: userData.lastSeenAt || null,
      invitationId: Invitation?._id || null,
      relationStatus: contactData
        ? "none"
        : Invitation
          ? Invitation.senderId.toString() === currentUserId.toString()
            ? "sent"
            : "received"
          : "add",
    },
    messages: messages.reverse(),
  };
};

const onGetConversation = async ({ currentUserId }) => {
  if (!currentUserId) return;

  const conversations =
    await CONVERSATION_REPOSITORY.findListByUserId(currentUserId);

  return conversations || [];
};

const onPinMessages = async ({
  conversationId,
  messageId,
  attachmentId,
  currentUserId,
}) => {
  if (!messageId) throw new Error("Not found message");
  if (!conversationId) throw new Error("Not found conversation");

  const session = client.startSession();

  try {
    session.startTransaction();

    const message = await MESSAGE_REPOSITORY.findOne(
      {
        _id: new ObjectId(messageId),
        deletedBy: {
          $nin: [currentUserId],
        },
        isRevoked: false,
      },
      session,
    );

    if (!message) throw new Error("Not found message");

    const conversation = await CONVERSATION_REPOSITORY.findOne(
      {
        _id: new ObjectId(conversationId),
        status: "active",
      },
      session,
    );

    if (!conversation) throw new Error("Not found conversation");

    const otherUser = await CONVERSATION_PARTICIPANT_REPOSITORY.findOne({
      conversationId,
      userId: {
        $ne: currentUserId,
      },
      leftAt: null,
    });

    const pinnedMessageCount = conversation.pinnedMessages?.length || 0;

    if (pinnedMessageCount >= 3)
      throw new Error("The number of pinned messages has reached its limit.");

    const pinnedCondition = attachmentId
      ? {
        messageId: messageId,
        attachmentId: attachmentId,
      }
      : {
        messageId: messageId,
        attachmentId: null,
      };

    const isPinnedMessage = await CONVERSATION_REPOSITORY.findOne(
      {
        _id: new ObjectId(conversationId),
        status: "active",

        pinnedMessages: {
          $elemMatch: pinnedCondition,
        },
      },
      session,
    );

    if (isPinnedMessage) {
      throw new Error(
        attachmentId
          ? "This attachment has already been pinned."
          : "This message has already been pinned.",
      );
    }

    const pinnedMessage = await CONVERSATION_REPOSITORY.updateOne(
      {
        _id: new ObjectId(conversationId),
      },
      {
        $addToSet: {
          pinnedMessages: {
            messageId,
            attachmentId,
            pinnedBy: currentUserId,
            pinnedAt: new Date(),
          },
        },
        $set: {
          updatedAt: new Date(),
        },
      },
      session,
    );

    const dataCreated = {
      id: message._id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type,
      content: message.content ?? null,
      gifUrl: message.gifUrl ?? null,
      attachmentId,
      attachments:
        attachmentId !== null
          ? message.attachments.filter(
            (item) => item.attachmentId === attachmentId,
          )
          : (message.attachments ?? []),
      createdAt: message.createdAt,
    };

    await session.commitTransaction();

    emitPinMessages(currentUserId, dataCreated);
    emitPinMessages(
      otherUser.userId,
      dataCreated,
    );

    return dataCreated;
  } catch (error) {
    throw error;
  } finally {
    session.endSession();
  }
};

const onGetPinMessages = async (conversationId, currentUserId = null) => {
  if (!conversationId) throw new Error("Unable to load pinned message");

  const conversation = await CONVERSATION_REPOSITORY.findOne({
    _id: new ObjectId(conversationId),
  });

  if (!conversation) throw new Error("Not found conversation");

  const pinMessages =
    await CONVERSATION_REPOSITORY.findManyPinMessages(conversationId, currentUserId);

  return {
    conversationId,
    pinMessages,
  };
};

const onDeletePinMessages = async ({
  conversationId,
  messageId,
  attachmentId,
  currentUserId
}) => {
  if (!conversationId) throw new Error("Not found conversantion");
  if (!messageId) throw new Error("Not found message");

  const session = client.startSession();
  try {
    session.startTransaction();

    const conversation = await CONVERSATION_REPOSITORY.findOne(
      {
        _id: new ObjectId(conversationId),
        status: "active",
      },
      session,
    );

    if (!conversation) throw new Error("Not found conversation");

    const message = await MESSAGE_REPOSITORY.findOne(
      {
        _id: new ObjectId(messageId),
      },
      session,
    );

    if (!message) throw new Error("Not found message");

    await CONVERSATION_REPOSITORY.deletePinMessage(
      conversationId,
      messageId,
      attachmentId === "null" ? null : attachmentId,
      session,
    );

    const otherUser = await CONVERSATION_PARTICIPANT_REPOSITORY.findOne({
      conversationId,
      userId: {
        $ne: currentUserId,
      },
      leftAt: null,
    });

    await session.commitTransaction();

    const dataDeleted = {
      conversationId,
      messageId,
      attachmentId
    }

    await emitDeletePinMessages(currentUserId, dataDeleted);

    await emitDeletePinMessages(otherUser.userId, dataDeleted);

    return dataDeleted
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }
};

const onGetMoreMessages = async ({ conversationId, beforeTimestamp, currentUserId }) => {
  if (!conversationId) throw new Error("Unable to load messages");

  const messages =
    await MESSAGE_REPOSITORY.onGetMoreMessages(
      conversationId,
      beforeTimestamp,
      currentUserId,
    )

  return { conversationId, messages: messages.reverse() };
};

export const CONVERSATION_SERVICE = {
  onGetOrCreateConversation,
  onGetConversationById,
  onGetConversation,
  onPinMessages,
  onGetPinMessages,
  onDeletePinMessages,
  onGetMoreMessages
};
