import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { CONVERSATION_CONTROLLER } from '../controlles/conversation.controller.js'

const conversationRouter = Router()

conversationRouter.delete('/conversations/pin-messages/:conversationId/:messageId{/:attachmentId}', authMiddleware, CONVERSATION_CONTROLLER.onDeletePinMessages)
conversationRouter.post('/conversations/pin-messages', authMiddleware, CONVERSATION_CONTROLLER.onPinMessages)
conversationRouter.post('/conversations', authMiddleware, CONVERSATION_CONTROLLER.onGetOrCreateConversation)
conversationRouter.get('/conversations', authMiddleware, CONVERSATION_CONTROLLER.onGetConversation)
conversationRouter.get('/conversations/pin-messages/:conversationId', authMiddleware, CONVERSATION_CONTROLLER.onGetPinMessages)
conversationRouter.get('/conversations/:conversationId', authMiddleware, CONVERSATION_CONTROLLER.onGetConversationById)

conversationRouter.post('/conversations/more-messages', authMiddleware, CONVERSATION_CONTROLLER.onGetMoreMessages)

export default conversationRouter
