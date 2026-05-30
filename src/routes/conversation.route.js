import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { CONVERSATION_CONTROLLER } from '../controlles/conversation.controller.js'

const conversationRouter = Router()

conversationRouter.post('/conversations', authMiddleware, CONVERSATION_CONTROLLER.onGetOrCreateConversation)
conversationRouter.get('/conversations', authMiddleware, CONVERSATION_CONTROLLER.onGetConversation)
conversationRouter.get('/conversations/:conversationId', authMiddleware, CONVERSATION_CONTROLLER.onGetConversationById)

export default conversationRouter
