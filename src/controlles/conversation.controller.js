import { CONVERSATION_SERVICE } from "../service/conversation.service.js";

const onGetOrCreateConversation = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user.id;

    const conversation = await CONVERSATION_SERVICE.onGetOrCreateConversation({
      currentUserId,
      userId,
    });
    res.status(200).json({
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

const onGetConversationById = async (req, res, next) => {
  try {
    const conversationId = req.params.conversationId;
    const currentUserId = req.user.id;

    const conversation = await CONVERSATION_SERVICE.onGetConversationById({
      conversationId,
      currentUserId,
    });

    return res.status(200).json({
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

const onGetConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    const conversations = await CONVERSATION_SERVICE.onGetConversation({
      currentUserId,
    });

    return res.status(200).json({
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};

const onPinMessages = async (req, res, next) => {
  try {
    const { conversationId, messageId, attachmentId } = req.body;
    const currentUserId = req.user.id;

    const result = await CONVERSATION_SERVICE.onPinMessages({
      conversationId,
      messageId,
      attachmentId,
      currentUserId,
    });

    return res.status(201).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const onGetPinMessages = async (req, res, next) => {
  try {
    const conversationId = req.params.conversationId;
    const currentUserId = req.user.id;

    const data = await CONVERSATION_SERVICE.onGetPinMessages(conversationId, currentUserId);

    return res.status(200).json({
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

const onDeletePinMessages = async (req, res, next) => {
  try {
    const { conversationId, messageId, attachmentId } = req.params;
    const currentUserId = req.user.id

    const result = await CONVERSATION_SERVICE.onDeletePinMessages({
      conversationId,
      messageId,
      attachmentId,
      currentUserId
    });

    return res.status(201).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const onGetMoreMessages = async (req, res, next) => {
  try {
    const { conversationId, beforeTimestamp } = req.body;
    const currentUserId = req.user.id

    const result = await CONVERSATION_SERVICE.onGetMoreMessages({
      conversationId,
      beforeTimestamp,
      currentUserId,
    });

    return res.status(200).json({
      data: result,
    });

  } catch (error) {
    next(error);
  }
};

const onDeleteConversation = async(req, res, next) => {
  try {
    const {conversationId} = req.params;
    const currentUserId = req.user.id;

    const result = await CONVERSATION_SERVICE.onDeleteConversation({
      conversationId,
      currentUserId,
    });

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    next(error)
  }
}

export const CONVERSATION_CONTROLLER = {
  onGetOrCreateConversation,
  onGetConversationById,
  onGetConversation,
  onPinMessages,
  onGetPinMessages,
  onDeletePinMessages,
  onGetMoreMessages,
  onDeleteConversation
};
