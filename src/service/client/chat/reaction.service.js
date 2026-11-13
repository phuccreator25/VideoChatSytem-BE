import { client } from "../../../config/database.js";
import { CONVERSATION_REPOSITORY } from "../../../repository/conversation.repository.js";
import { ObjectId } from "mongodb";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../../../repository/conversationParticipant.repository.js";
import { MESSAGE_REPOSITORY } from "../../../repository/message.repository.js";
import {
  emitReactEmotion,
  emitUnReactEmotion,
} from "../../../sockets/emitters/messages.emitter.js";
import { MESSAGE_REACTION_REPOSITORY } from "../../../repository/messageReaction.repository.js";
import { BLOCK_REPOSITORY } from "../../../repository/block.repository.js";

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

    const [conversation, ortherUserId, message, isEmotion] = await Promise.all([
      CONVERSATION_REPOSITORY.findOne({ _id: new ObjectId(conversationId), status: "active" }, session),
      CONVERSATION_PARTICIPANT_REPOSITORY.findOtherUserIdByConversation(conversationId, currentUserId),
      MESSAGE_REPOSITORY.findOne({ _id: new ObjectId(messageId), deletedBy: { $nin: [currentUserId] }, isRevoked: false }, session),
      MESSAGE_REACTION_REPOSITORY.findOne({ messageId, userId: currentUserId }, session)
    ])

    if (!conversation) throw new Error("Not found conversation");
    if (!ortherUserId) throw new Error("You are not allowed to perform this action. Please unblock the other person.");
    if (!message) throw new Error("Not found message");

    const block = await BLOCK_REPOSITORY.findByBlock(currentUserId, ortherUserId);
    if (block?.status === 'blocked') {
      throw new Error("You are not allowed to perform this action. Please unblock the other person.");
    }

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

    const [reactionsForSender, reactionsForReceiver] = await Promise.all([
      MESSAGE_REACTION_REPOSITORY.findByMessageWithUserName({ messageId, currentUserId }),
      MESSAGE_REACTION_REPOSITORY.findByMessageWithUserName({ messageId, currentUserId: ortherUserId })
    ]);

    emitReactEmotion(currentUserId, {
      messageId,
      reactions: reactionsForSender,
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

    const [conversation, ortherUserId, message, isUnReactEmotion] = await Promise.all([
      CONVERSATION_REPOSITORY.findOne({ _id: new ObjectId(conversationId), status: "active" }, session),
      CONVERSATION_PARTICIPANT_REPOSITORY.findOtherUserIdByConversation(conversationId, currentUserId),
      MESSAGE_REPOSITORY.findOne({ _id: new ObjectId(messageId), deletedBy: { $nin: [currentUserId] }, isRevoked: false }, session),
      MESSAGE_REACTION_REPOSITORY.findOne({ messageId, userId: currentUserId }, session)
    ]);

    if (!conversation) throw new Error("Not found conversation");
    if (!ortherUserId) throw new Error("You are not allowed to perform this action. Please unblock the other person.");
    if (!message) throw new Error("Not found message");
    if (!isUnReactEmotion) throw new Error("Not found react emotion");

    const block = await BLOCK_REPOSITORY.findByBlock(currentUserId, ortherUserId);
    if (block?.status === 'blocked') {
      throw new Error("You are not allowed to perform this action. Please unblock the other person.");
    }

    await MESSAGE_REACTION_REPOSITORY.deleteOne(
      { messageId, userId: currentUserId },
      session,
    );

    await session.commitTransaction();

    const reactionsForSender = await MESSAGE_REACTION_REPOSITORY.findByMessageWithUserName({
      messageId,
      currentUserId: currentUserId,
    });

    emitUnReactEmotion(currentUserId, {
      messageId,
      reactions: reactionsForSender,
    });

    const reactionsForReceiver = await MESSAGE_REACTION_REPOSITORY.findByMessageWithUserName({
      messageId,
      currentUserId: ortherUserId,
    });

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
