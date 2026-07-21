import { Router } from 'express'
import { CONTACT_CONTROLLER } from '../controlles/contacts.controller.js'
import { authMiddleware } from '../middleware/authMiddleware.js'

const contactRouter = Router()

contactRouter.get('/contacts', authMiddleware, CONTACT_CONTROLLER.onGetData)
contactRouter.put('/contacts', authMiddleware, CONTACT_CONTROLLER.onUpdateContact)
contactRouter.delete('/contacts/:idFriend', authMiddleware, CONTACT_CONTROLLER.onRemoveFriend)

contactRouter.get('/contacts/user-online', authMiddleware, CONTACT_CONTROLLER.onGetContactsOnlines)

export default contactRouter