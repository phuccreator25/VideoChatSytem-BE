import { ObjectId } from "mongodb";
import { CONTACTS_REPOSITORY } from "../repository/contacts.repository.js";
import { CONVERSATION_REPOSITORY } from "../repository/conversation.repository.js";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../repository/conversationParticipant.repository.js";
import { MESSAGE_REPOSITORY } from "../repository/message.repository.js";
import { USER_REPOSITORY } from "../repository/user.repository.js";
import { client } from "../config/database.js";

const onGetOrCreateConversation = async ({ currentUserId, userId }) => {
  if (!currentUserId || !userId) throw new Error("UserID or CurrentUserId are required");
  if (String(currentUserId) === String(userId)) {
    throw new Error("Cannot create conversation with yourself");
  }

  const conversation =
    await CONVERSATION_REPOSITORY.findConversationBetweenUser(
      currentUserId,
      userId
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
      session
    );

    await CONVERSATION_PARTICIPANT_REPOSITORY.createOne(
      {
        conversationId: newConversation._id.toString(),
        userId: currentUserId,
      },
      session
    );

    await CONVERSATION_PARTICIPANT_REPOSITORY.createOne(
      {
        conversationId: newConversation._id.toString(),
        userId: userId,
      },
      session
    );

    await session.commitTransaction();
    return newConversation;
  } catch (error) {
    console.log(error);
    
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const onGetConversationById = async ({ conversationId, currentUserId }) => {
  if (!conversationId) throw new Error("Conversation ID is required");

  const conversation = await CONVERSATION_REPOSITORY.findOne({
    _id: new ObjectId(conversationId),
    type: "direct",
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

  const [userData, contactData, messages] = await Promise.all([
    USER_REPOSITORY.findById(otherUserId),
    CONTACTS_REPOSITORY.findContactItem(currentUserId, otherUserId),
    MESSAGE_REPOSITORY.findByConversationId(conversationId, {
      limit: 30,
      sort: { createdAt: -1 },
    }),
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
    },
    user: {
      userId: userData._id,
      avatar: userData.avatar,
      fullname: userData.fullname,
      nickname: contactData?.nickname || null,
      isOnline: userData.status,
      lastSeenAt: userData.lastSeenAt || null,
    },
    messages: messages.reverse(),
  };
};

export const CONVERSATION_SERVICE = {
  onGetOrCreateConversation,
  onGetConversationById,
};
