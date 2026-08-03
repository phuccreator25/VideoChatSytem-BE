import { client } from "../../config/database.js";
import { CONVERSATION_REPOSITORY } from "../../repository/conversation.repository.js";
import { ObjectId } from "mongodb";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../../repository/conversationParticipant.repository.js";
import { MESSAGE_REPOSITORY } from "../../repository/message.repository.js";
import { USER_REPOSITORY } from "../../repository/user.repository.js";
import {
  emitDeleteMessage,
  emitRevokeMessage,
} from "../../sockets/emitters/messages.emitter.js";
import { CONTACTS_REPOSITORY } from "../../repository/contacts.repository.js";

export const onDeleteMessage = async ({ conversationId, messageId, currentUserId }) => {
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

export const onRevokeMessage = async ({ conversationId, messageId, currentUserId }) => {
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

export const onSearchMessage = async ({ conversationId, keyword, currentUserId }) => {
  try {
    if (!conversationId) return;

    if (!keyword) throw new Error("Please enter a keyword to search");

    const messages = await MESSAGE_REPOSITORY.searchMessages({
      conversationId,
      keyword,
      currentUserId,
    });

    return messages;
  } catch (error) {
    throw error;
  }
};

export const onSearchMessageGlobal = async (currentUserId, keyword) => {
  try {
    if (!keyword || !keyword.trim()) return [];

    const messages = await MESSAGE_REPOSITORY.searchMessagesGlobal(keyword.trim());

    const formattedMessages = await Promise.all(
      messages.map(async (msg) => {
        let senderName = "User";

        if (currentUserId && msg.senderId) {
          const contactDetail = await CONTACTS_REPOSITORY.findContactDetails(currentUserId, msg.senderId);
          
          if (contactDetail) {
            senderName = (contactDetail.nickname && contactDetail.nickname.trim())
              ? contactDetail.nickname
              : contactDetail.fullname;
          } else {
            const sender = await USER_REPOSITORY.findById(msg.senderId);
            if (sender) senderName = sender.fullname
          }
        }

        return {
          messageId: msg.id || msg._id.toString(),
          conversationId: msg.conversationId,
          content: msg.content,
          createdAt: msg.createdAt,
          senderName: senderName,
        };
      })
    );

    return formattedMessages;
  } catch (error) {
    throw error;
  }
};
