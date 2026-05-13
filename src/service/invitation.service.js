import { client } from "../config/database.js";
import { invitationStatus } from "../data/invitation.data.js";
import { CONTACTS_REPOSITORY } from "../repository/contacts.repository.js";
import { INVITATION_REPOSITORY } from "../repository/invitation.repository.js";
import { USER_REPOSITORY } from "../repository/user.repository.js";
import { emitPresenceChanged } from "../sockets/emitters/auth.emitter.js";
import {
  emitInvitationAccept,
  emitInvitationCancel,
  emitInvitationReceived,
  emitInvitationDecline,
} from "../sockets/emitters/invitaion.emitter.js";

const onAddContact = async (payload, _currentIdUser) => {
  try {
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
          throw new Error("Bạn đã gửi lời mời cho người này rồi");
        }

        throw new Error("Người này đã gửi lời mời cho bạn rồi");
      }
    }

    if (contact) {
      throw new Error("Bạn và người này đã là bạn bè");
    }

    const dataCreated = {
      senderId: _currentIdUser,
      receiverId: payload.userId,
      message: payload.invitationMessage,
      status: invitationStatus.PENDING,
    };

    const result = await INVITATION_REPOSITORY.createOne(dataCreated);

    emitInvitationReceived(payload.userId, {
      invitationId: result.insertedId?.toString?.() || null,
      senderId: _currentIdUser,
      receiverId: payload.userId,
      message: payload.invitationMessage,
      status: invitationStatus.PENDING,
    });

    return result;
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
    console.log(data);

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

    const receiverStatus = await USER_REPOSITORY.findById(data.receiverId);
    const senderStatus = await USER_REPOSITORY.findById(data.senderId);

    await session.commitTransaction();

    emitInvitationAccept(data.senderId.toString(), {
      invitationId: data._id.toString(),
      status: invitationStatus.ACCEPTED,
    });

    emitPresenceChanged(data.receiverId, {
      userId: data.receiverId,
      isOnline: receiverStatus.status === 'online' ? true : false,
      lastSeenAt: receiverStatus.status === 'online' ? null : new Date(),
    })

    emitPresenceChanged(data.senderId, {
      userId: data.senderId,
      isOnline: senderStatus.status === 'online' ? true : false,
      lastSeenAt: senderStatus.status === 'online' ? null : new Date(),
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

    const data = await INVITATION_REPOSITORY.updateById(
      payload.id,
      invitationStatus.REJECTED,
    );

    emitInvitationDecline(invitation.senderId, {
      invitationId: invitation._id.toString(),
      status: invitationStatus.REJECTED,
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

    const data = await INVITATION_REPOSITORY.updateById(
      payload.id,
      invitationStatus.CANCELED,
    );

    emitInvitationCancel(invitation.receiverId, {
      invitationId: invitation._id.toString() || null,
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
