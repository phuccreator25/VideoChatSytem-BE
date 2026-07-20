import { client } from "../../config/database.js";
import { CONVERSATION_REPOSITORY } from "../../repository/conversation.repository.js";
import { ObjectId } from "mongodb";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../../repository/conversationParticipant.repository.js";
import { MESSAGE_REPOSITORY } from "../../repository/message.repository.js";
import {
  emitReactEmotion,
  emitUnReactEmotion,
} from "../../sockets/emitters/messages.emitter.js";
import { MESSAGE_REACTION_REPOSITORY } from "../../repository/messageReaction.repository.js";

export const onReactEmotion = async ({
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

export const onUnReactEmotion = async ({
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
