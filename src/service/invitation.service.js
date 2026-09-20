import { client } from "../config/database.js";
import { invitationStatus } from "../data/invitation.data.js";
import { CONTACTS_REPOSITORY } from "../repository/contacts.repository.js";
import { INVITATION_REPOSITORY } from "../repository/invitation.repository.js";
import { BLOCK_REPOSITORY } from "../repository/block.repository.js";
import { emitPresenceChanged } from "../sockets/emitters/auth.emitter.js";
import {
  emitInvitationAccept,
  emitInvitationCancel,
  emitInvitationReceived,
  emitInvitationDecline,
  emitInvitationSent,
} from "../sockets/emitters/invitaion.emitter.js";
import { isUserOnline } from "../sockets/socketStore.js";

const onAddContact = async (payload, _currentIdUser) => {
  try {
    const block = await BLOCK_REPOSITORY.findByBlock(_currentIdUser, payload.userId);
    if (block?.status === "blocked") {
      throw new Error("You are not allowed to perform this action. Please unblock the other person.");
    }
    const existingInvitation = await INVITATION_REPOSITORY.findByFilter({
      $or: [
        {
          senderId: _currentIdUser,
          receiverId: payload.userId,
        },
        {
          senderId: payload.userId,
          receiverId: _currentIdUser,
        },
      ],
      status: {
        $in: [invitationStatus.PENDING, invitationStatus.ACCEPTED],
      },
      deleteAt: null,
    });

    const contact = await CONTACTS_REPOSITORY.findContactItem(
      _currentIdUser,
      payload.userId,
    );

    if (existingInvitation) {
      if (existingInvitation.status === invitationStatus.PENDING) {
        if (existingInvitation.senderId === _currentIdUser) {
          throw new Error("You have already sent an invitation to this user");
        }

        throw new Error("This user has already sent you an invitation");
      }
    }

    if (contact) throw new Error("You and this user are already friends");

    const dataCreated = {
      senderId: _currentIdUser,
      receiverId: payload.userId,
      message: payload.invitationMessage,
      status: invitationStatus.PENDING,
    };

    const result = await INVITATION_REPOSITORY.createOne(dataCreated);

    emitInvitationSent(_currentIdUser, {
      invitationId: result.insertedId?.toString?.() || null,
      senderId: _currentIdUser,
      receiverId: payload.userId,
      status: invitationStatus.PENDING
    });

    emitInvitationReceived(payload.userId, {
      invitationId: result.insertedId?.toString?.() || null,
      senderId: _currentIdUser,
      receiverId: payload.userId,
      message: payload.invitationMessage,
      status: invitationStatus.PENDING,
    });
    
    return  {
      invitationId: result.insertedId?.toString?.() || null,
      senderId: _currentIdUser,
      receiverId: payload.userId,
      message: payload.invitationMessage,
      status: invitationStatus.PENDING,
    };
  } catch (error) {
    throw error;
  }
};

const onGetFriendRequest = async (_currentIdUser, options = {}) => {
  try {
    const data = await INVITATION_REPOSITORY.findMany(
      { receiverId: _currentIdUser },
      options,
    );

    return data;
  } catch (error) {
    throw error;
  }
};

const onGetSentInvitation = async (_currentIdUser, options = {}) => {
  try {
    const data = await INVITATION_REPOSITORY.findMany(
      { senderId: _currentIdUser },
      options,
    );
    return data;
  } catch (error) {
    throw error;
  }
};

const onGetCountFriendRequest = async (_currentIdUser) => {
  try {
    const data = await INVITATION_REPOSITORY.countReceived({
      receiverId: _currentIdUser,
    });
    return data;
  } catch (error) {
    throw error;
  }
};

const onGetCountSentInvitation = async (_currentIdUser) => {
  try {
    const data = await INVITATION_REPOSITORY.countSent({
      senderId: _currentIdUser,
    });
    return data;
  } catch (error) {
    throw error;
  }
};

const onAccept = async (payload, curretnUserId) => {
  const invitation = await INVITATION_REPOSITORY.findById(payload.id);

  if (!invitation) throw new Error("Invitation Not Found");

  if (invitation.receiverId !== curretnUserId)
    throw new Error("You have no right to accept.");

  if(invitation.status !== 'pending' || invitation.deleteAt !== null) 
    throw new Error('This invitation is invalid.')

  const session = client.startSession();

  try {
    await session.startTransaction();

    const data = await INVITATION_REPOSITORY.updateById(
      payload.id,
      invitationStatus.ACCEPTED,
      session
    );

    if (!data) throw new Error("Please try again");

    const receiverHasSender = await CONTACTS_REPOSITORY.findContactItem(
      data.receiverId,
      data.senderId,
    );

    if (!receiverHasSender) {
      await CONTACTS_REPOSITORY.createOne({
        ownerId: data.receiverId,
        contactUserId: data.senderId,
        nickname: null,
      }, session);
    }

    const senderHasReceiver = await CONTACTS_REPOSITORY.findContactItem(
      data.senderId,
      data.receiverId,
    );

    if (!senderHasReceiver) {
      await CONTACTS_REPOSITORY.createOne({
        ownerId: data.senderId,
        contactUserId: data.receiverId,
        nickname: null,
      }, session);
    }

    await session.commitTransaction();

    emitInvitationAccept(data.senderId.toString(), {
      invitationId: data._id.toString(),
      receiverId: data.receiverId,
      senderId: data.senderId,
      status: invitationStatus.ACCEPTED,
    });

    emitInvitationAccept(data.receiverId.toString(), {
      invitationId: data._id.toString(),
      senderId: data.senderId,
      receiverId: data.receiverId,
      status: invitationStatus.ACCEPTED,
    });

    emitPresenceChanged(data.receiverId, {
      userId: data.senderId,
      isOnline: isUserOnline(data.senderId) ? true : false,
      lastSeenAt: isUserOnline(data.senderId) ? null : new Date(),
    })

    emitPresenceChanged(data.senderId, {
      userId: data.receiverId,
      isOnline: isUserOnline(data.receiverId) ? true : false,
      lastSeenAt: isUserOnline(data.receiverId) ? null : new Date(),
    })

    return data;
  } catch (error) {
    throw error;
  } finally {
    session.endSession();
  }
};

const onDecline = async (payload, currentUserId) => {
  try {
    const invitation = await INVITATION_REPOSITORY.findById(payload.id);

    if (!invitation) throw new Error("Invitation Not Found");

    if (invitation.receiverId !== currentUserId)
      throw new Error("You have no right to decline.");

    if(invitation.status !== 'pending' || invitation.deleteAt !== null)
      throw new Error('This invitation is invalid.')

    const data = await INVITATION_REPOSITORY.updateById(
      payload.id,
      invitationStatus.DECLINED,
    );

    emitInvitationDecline(invitation.senderId, {
      invitationId: invitation._id.toString(),
      receiverId: invitation.receiverId,
      senderId: invitation.senderId,
      status: invitationStatus.DECLINED,
    });

    emitInvitationDecline(invitation.receiverId, {
      invitationId: invitation._id.toString(),
      senderId: invitation.senderId,
      receiverId: invitation.receiverId,
      status: invitationStatus.DECLINED,
    });

    return data;
  } catch (error) {
    throw error;
  }
};

const onCancelSent = async (payload, currentUserId) => {
  try {
    const invitation = await INVITATION_REPOSITORY.findById(payload.id);

    if (!invitation) throw new Error("Invitation Not Found");

    if (invitation.senderId !== currentUserId)
      throw new Error("You have no right to cancel.");

    if(invitation.status !== 'pending' || invitation.deleteAt !== null)
      throw new Error('This invitation is invalid.')

    const data = await INVITATION_REPOSITORY.updateById(
      payload.id,
      invitationStatus.CANCELED,
    );

    emitInvitationCancel(invitation.receiverId, {
      invitationId: invitation._id.toString() || null,
      status: invitationStatus.CANCELED,
      senderId: invitation.senderId,
      receiverId: invitation.receiverId,
    });

    emitInvitationCancel(invitation.senderId, {
      invitationId: invitation._id.toString() || null,
      senderId: invitation.senderId,
      receiverId: invitation.receiverId,
      status: invitationStatus.CANCELED,
    });

    return data;
  } catch (error) {
    throw error;
  }
};

export const INVITATION_SERVICE = {
  onAddContact,
  onAccept,
  onGetFriendRequest,
  onGetSentInvitation,
  onGetCountFriendRequest,
  onGetCountSentInvitation,
  onDecline,
  onCancelSent,
};
