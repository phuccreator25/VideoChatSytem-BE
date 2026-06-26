import { CHAT_SERVICE } from "../service/chat.service.js";

const onSendMessage = async (req, res, next) => {
  try {
    const messagePayload = req.body;
    const files = req.files || []
    const { conversationId } = req.params;
    const currentUserId = req.user.id;

    const message = await CHAT_SERVICE.onSendMessage({
      message: messagePayload,
      files,
      conversationId,
      currentUserId,
    });

    return res.status(201).json({
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

const onReactEmotion = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const currentUserId = req.user.id;
    const emotionPayload = req.body

    const emotions = await CHAT_SERVICE.onReactEmotion({ conversationId, messageId, currentUserId, emotionPayload });

    return res.status(201).json({
      data: emotions
    })

  } catch (error) {
    next(error)
  }
}

const onUnReactEmotion = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const currentUserId = req.user.id;

    const emotions = await CHAT_SERVICE.onUnReactEmotion({ conversationId, messageId, currentUserId });

    return res.status(201).json({
      data: emotions
    })

  } catch (error) {
    next(error)
  }
}

const onForwardMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;
    const { selectedIds } = req.body;

    const message = await CHAT_SERVICE.onForwardMessage({
      selectedIds,
      messageId,
      senderId: currentUserId,
    });

    return res.status(201).json({
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

const onDeleteMessage = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const currentUserId = req.user.id;

    const message = await CHAT_SERVICE.onDeleteMessage({ conversationId, messageId, currentUserId });

    return res.status(201).json({
      data: message
    })

  } catch (error) {
    next(error)
  }
}

const onRevokeMessage = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const currentUserId = req.user.id;

    const message = await CHAT_SERVICE.onRevokeMessage({ conversationId, messageId, currentUserId });

    return res.status(201).json({
      data: message
    })

  } catch (error) {
    next(error)
  }
}

export const CHAT_CONTROLLER = {
  onSendMessage,
  onReactEmotion,
  onUnReactEmotion,
  onForwardMessage,
  onDeleteMessage,
  onRevokeMessage,
};