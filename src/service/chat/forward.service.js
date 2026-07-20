import { client } from "../../config/database.js";
import { CONVERSATION_REPOSITORY } from "../../repository/conversation.repository.js";
import { ObjectId } from "mongodb";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../../repository/conversationParticipant.repository.js";
import { MESSAGE_DELIVERY_REPOSITORY } from "../../repository/messageDeliveries.repository.js";
import { isUserOnline } from "../../sockets/socketStore.js";
import { MESSAGE_REPOSITORY } from "../../repository/message.repository.js";
import { emitNewMessages } from "../../sockets/emitters/messages.emitter.js";
import { shareMessageQueue, linkPreviewQueue } from "../../queues/uploadFileQueue.js";

export const onForwardMessageSingle = async ({ messageId, targetUserId, senderId, conversationId }) => {
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

    const clonedAttachments = (message.attachments || []).map(att => ({
      attachmentId: new ObjectId().toString(),
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

    const messageData = {
      conversationId: finalConversationId,
      senderId,
      type: message.type,
      content: message.content,
      gifUrl: message.gifUrl,
      attachments: clonedAttachments,
      preview: message.preview || null,
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

    const URL_REGEX = /(https?:\/\/[^\s]+)/g;
    const match = messageCreated.content ? messageCreated.content.match(URL_REGEX) : null;

    if (
      !messageCreated.preview &&
      match &&
      match.length === 1 &&
      messageCreated.type === "text" &&
      !messageCreated.attachments &&
      !messageCreated.gifUrl
    ) {
      const url = match[0];

      linkPreviewQueue.add(
        "get-link-preview",
        {
          messageId: newMsgId,
          url,
          currentUserId: senderId,
          ortherUserId: targetUserId,
        },
        {
          attempts: 3,
          backoff: { delay: 1000, type: "exponential" },
        },
      );
    }

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

export const onForwardMessage = async ({ selectedIds, messageId, senderId }) => {
  try {
    if (!selectedIds || !messageId || !senderId) return;

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
