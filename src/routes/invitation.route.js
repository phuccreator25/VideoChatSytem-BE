import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { INVITATION_CONTROLLER } from "../controlles/invitation.controller.js";

const invitationRouter = Router()

invitationRouter.post('/invitations', authMiddleware, INVITATION_CONTROLLER.onAddContact);
invitationRouter.post('/invitations/accept', authMiddleware, INVITATION_CONTROLLER.onAccept);
invitationRouter.post('/invitations/decline', authMiddleware, INVITATION_CONTROLLER.onDecline);
invitationRouter.post('/invitations/cancel-sent', authMiddleware, INVITATION_CONTROLLER.onCancelSent);
invitationRouter.get('/invitations/friend-request', authMiddleware, INVITATION_CONTROLLER.onGetFriendRequest);
invitationRouter.get('/invitations/sent-invitation', authMiddleware, INVITATION_CONTROLLER.onGetSentInvitation);
invitationRouter.get('/invitations/friend-request/count', authMiddleware, INVITATION_CONTROLLER.onGetCountFriendRequest);
invitationRouter.get('/invitations/sent-invitation/count', authMiddleware, INVITATION_CONTROLLER.onGetCountSentInvitation);

export default invitationRouter