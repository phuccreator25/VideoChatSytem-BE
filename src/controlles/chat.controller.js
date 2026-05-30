import { CHAT_SERVICE } from "../service/chat.service.js";

const onSendMessage = async (req, res, next) => {
  try {
    const messagePayload = req.body;
    const { conversationId } = req.params;
    const currentUserId = req.user.id;

    const message = await CHAT_SERVICE.onSendMessage({
      message: messagePayload,
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

export const CHAT_CONTROLLER = {
  onSendMessage,
};