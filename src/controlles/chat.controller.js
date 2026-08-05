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

const onSearchMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user.id;
    const { keyword } = req.body;

    const messages = await CHAT_SERVICE.onSearchMessage({ conversationId, keyword, currentUserId });

    return res.status(200).json({
      data: messages
    });
  } catch (error) {
    next(error);
  }
};

const onGetShareMedia = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const currentUserId = req.user.id;
    const messages = await CHAT_SERVICE.onGetShareMedia({
      conversationId,
      limit: Number(limit),
      skip: Number(skip),
      currentUserId,
    });

    return res.status(200).json({
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

const onGetShareFiles = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const currentUserId = req.user.id;
    const messages = await CHAT_SERVICE.onGetShareFiles({
      conversationId,
      limit: Number(limit),
      skip: Number(skip),
      currentUserId,
    });

    return res.status(200).json({
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

const onGetShareLinks = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const currentUserId = req.user.id;
    const messages = await CHAT_SERVICE.onGetShareLinks({
      conversationId,
      limit: Number(limit),
      skip: Number(skip),
      currentUserId,
    });

    return res.status(200).json({
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

const onGetLinkPreview = async (req, res, next) => {
  try {
    const { url } = req.query;

    const preview = await CHAT_SERVICE.onGetLinkPreview({ url });

    return res.status(200).json({
      data: preview,
    });
  } catch (error) {
    next(error);
  }
};

const onSearchMessageGlobal = async (req, res, next) => {
  try {
    const { keyword } = req.query;
    const currentUserId = req.user?.id;

    const messages = await CHAT_SERVICE.onSearchMessageGlobal(currentUserId, keyword);

    return res.status(200).json({
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};


export const CHAT_CONTROLLER = {
  onSendMessage,
  onReactEmotion,
  onUnReactEmotion,
  onForwardMessage,
  onDeleteMessage,
  onRevokeMessage,
  onSearchMessage,
  onGetShareMedia,
  onGetShareFiles,
  onGetShareLinks,
  onGetLinkPreview,
  onSearchMessageGlobal,
};