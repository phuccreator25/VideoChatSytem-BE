import { invitationStatus } from "../data/invitation.data.js";
import { CONTACTS_REPOSITORY } from "../repository/contacts.repository.js";
import { INVITATION_REPOSITORY } from "../repository/invitation.repository.js";

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

    if (existingInvitation) {
      if (existingInvitation.status === invitationStatus.PENDING) {
        if (existingInvitation.senderId === _currentIdUser) {
          throw new Error("Bạn đã gửi lời mời cho người này rồi");
        }

        throw new Error("Người này đã gửi lời mời cho bạn rồi");
      }

      if (existingInvitation.status === invitationStatus.ACCEPTED) {
        throw new Error("Bạn và người này đã là bạn bè");
      }
    }

    const dataCreated = {
      senderId: _currentIdUser,
      receiverId: payload.userId,
      message: payload.invitationMessage,
      status: invitationStatus.PENDING,
    };

    const result = await INVITATION_REPOSITORY.createOne(dataCreated);

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

const onAccept = async (payload) => {
  try {
    const invitation = await INVITATION_REPOSITORY.findById(payload.id);

    if (!invitation) throw new Error("Invitation Not Found");

    const data = await INVITATION_REPOSITORY.updateById(
      payload.id,
      invitationStatus.ACCEPTED,
    );

    if (!data) throw new Error("Please try again");

    const receiverContactData = {
      userId: data.senderId,
      addedAt: new Date(),
      nickname: null,
    };

    const senderContactData = {
      userId: data.receiverId,
      addedAt: new Date(),
      nickname: null,
    };

    const receiverContactDoc = await CONTACTS_REPOSITORY.findByUserId(
      data.receiverId,
    );

    if (!receiverContactDoc) {
      await CONTACTS_REPOSITORY.createOne({
        userId: data.receiverId,
        contactUserId: [receiverContactData],
      });
    } else {
      const receiverHasSender = await CONTACTS_REPOSITORY.findContactItem(
        data.receiverId,
        data.senderId,
      );

      if (receiverHasSender)
        throw new Error("This account is already your friend.");

      await CONTACTS_REPOSITORY.pushContactUser(
        data.receiverId,
        receiverContactData,
      );
    }

    const senderContactDoc = await CONTACTS_REPOSITORY.findByUserId(
      data.senderId,
    );

    if (!senderContactDoc) {
      await CONTACTS_REPOSITORY.createOne({
        userId: data.senderId,
        contactUserId: [senderContactData],
      });
    } else {
      const senderHasReceiver = await CONTACTS_REPOSITORY.findContactItem(
        data.senderId,
        data.receiverId,
      );

      if (senderHasReceiver)
        throw new Error("This account is already your friend.");

      await CONTACTS_REPOSITORY.pushContactUser(
        data.senderId,
        senderContactData,
      );
    }

    return data;
  } catch (error) {
    throw error;
  }
};

const onDecline = async (payload) => {
  try {
    const invitation = await INVITATION_REPOSITORY.findById(payload.id);

    if (!invitation) throw new Error("Invitation Not Found");

    const data = await INVITATION_REPOSITORY.updateById(
      payload.id,
      invitationStatus.REJECTED,
    );

    return data;
  } catch (error) {
    throw error;
  }
};

const onCancelSent = async (payload) => {
  try {
    const invitation = await INVITATION_REPOSITORY.findById(payload.id);

    if (!invitation) throw new Error("Invitation Not Found");

    const data = await INVITATION_REPOSITORY.updateById(
      payload.id,
      invitationStatus.CANCELED,
    );

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
  onDecline,
  onCancelSent,
};
