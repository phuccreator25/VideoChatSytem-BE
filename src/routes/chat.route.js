import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { CHAT_CONTROLLER } from "../controlles/chat.controller.js";
import { uploadMultiFile } from "../middleware/uploadMessages.middleware.js";

const chatRouter = Router()

chatRouter.post('/chats/:conversationId/send-message', authMiddleware, uploadMultiFile.array('files', 15), CHAT_CONTROLLER.onSendMessage)
chatRouter.post('/chats/react-emotion/:conversationId/:messageId', authMiddleware, CHAT_CONTROLLER.onReactEmotion)
chatRouter.delete('/chats/unreact-emotion/:conversationId/:messageId', authMiddleware, CHAT_CONTROLLER.onUnReactEmotion)
chatRouter.post('/chats/forward-message/:messageId', authMiddleware, CHAT_CONTROLLER.onForwardMessage)
chatRouter.delete('/chats/delete-message/:conversationId/:messageId', authMiddleware, CHAT_CONTROLLER.onDeleteMessage)
chatRouter.put('/chats/revoke-message/:conversationId/:messageId', authMiddleware, CHAT_CONTROLLER.onRevokeMessage)

export default chatRouter