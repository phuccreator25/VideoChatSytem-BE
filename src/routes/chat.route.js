import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { CHAT_CONTROLLER } from "../controlles/chat.controller.js";

const chatRouter = Router()

chatRouter.post('/chats/:conversationId/send-message', authMiddleware, CHAT_CONTROLLER.onSendMessage)

export default chatRouter