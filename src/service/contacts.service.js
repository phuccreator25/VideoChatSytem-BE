import { client, GET_DB } from "../config/database.js";
import { CONTACTS_REPOSITORY } from "../repository/contacts.repository.js";
import { USER_REPOSITORY } from "../repository/user.repository.js";
import { emitPresenceChanged } from "../sockets/emitters/auth.emitter.js";
import { emitContactRemove, emitContactUpdateNickName } from "../sockets/emitters/contact.emitter.js";
import { isUserOnline } from "../sockets/socketStore.js";

const onGetData = async (currentUserId) => {
  const contacts = await CONTACTS_REPOSITORY.findMany(currentUserId);
  return contacts;
};

const onUpdateContact = async ({ currentUserId, payload }) => {
  try {
    const { userId, nickname } = payload;

    if (!userId) {
      throw new Error("ContactUserId is required");
    }

    const contact = await CONTACTS_REPOSITORY.findContactItem(
      currentUserId,
      userId,
    );

    if (!contact) {
      throw new Error("Contact not found");
    }

    const FinallyNickName =
      typeof nickname === "string" && nickname.trim() === "" ? null : nickname;

    const contactUpdated = await CONTACTS_REPOSITORY.updateOne({
      filter: {
        ownerId: currentUserId,
        contactUserId: userId,
      },
      data: {
        nickname: FinallyNickName,
      },
    });

    emitContactUpdateNickName(currentUserId, {
      userId: userId,
      nickname: FinallyNickName,
    });

    return contactUpdated;
  } catch (error) {
    throw error;
  }
};

const onRemoveContact = async ({ ownerId, friendId }) => {
  const session = client.startSession();

  try {
    if (!ownerId || !friendId) return;

    const contactOwner = await CONTACTS_REPOSITORY.findContactItem(
      ownerId,
      friendId,
    );

    const contactFriend = await CONTACTS_REPOSITORY.findContactItem(
      friendId,
      ownerId,
    );

    if (!contactFriend || !contactOwner) throw new Error("Contact Not Found");

    session.startTransaction();
    await CONTACTS_REPOSITORY.deleteOne(
      {
        ownerId,
        contactUserId: friendId,
      },
      session,
    );

    await CONTACTS_REPOSITORY.deleteOne(
      {
        ownerId: friendId,
        contactUserId: ownerId,
      },
      session,
    );

    await session.commitTransaction();

    emitContactRemove(friendId, {
      senderId: ownerId,
      receiverId: friendId
    });

    emitContactRemove(ownerId, {
      senderId: ownerId,
      receiverId: friendId
    });

    emitPresenceChanged(friendId, {
      userId: ownerId,
      isOnline: isUserOnline(ownerId) ? true : false,
      lastSeenAt: isUserOnline(ownerId) ? null : new Date(),
    });

    emitPresenceChanged(ownerId, {
      userId: friendId,
      isOnline: isUserOnline(friendId) ? true : false,
      lastSeenAt: isUserOnline(friendId) ? null : new Date(),
    });

    return true;
  } catch (error) {
    throw error;
  } finally {
    session.endSession();
  }
};

const onGetContactOfUserOnline = async (userId) => {
  const filter = {
    userId,
  };

  const contactIds = await CONTACTS_REPOSITORY.findUserOnline(filter);

  const onlineContactIds = contactIds.filter((contactId) =>
    isUserOnline(contactId)
  );

  return onlineContactIds;
};

export const CONTACT_SERVICE = {
  onGetData,
  onUpdateContact,
  onRemoveContact,
  onGetContactOfUserOnline
};
