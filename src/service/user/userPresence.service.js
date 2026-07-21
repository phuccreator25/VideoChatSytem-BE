import {
  addUserSocket,
  isUserOnline,
  removeUserSocket,
} from "../../sockets/socketStore.js";
import { CONTACT_SERVICE } from "../contacts.service.js";
import {
  emitOnlineUsers,
  emitPresenceChanged,
} from "../../sockets/emitters/auth.emitter.js";
import { CALL_SERVICE } from "../call.service.js";
import { CALL_REPOSITORY } from "../../repository/call.repository.js";
import { callStatuses } from "../../data/call.data.js";
import { onUpdateStatus } from "./userProfile.service.js";
import { USER_REPOSITORY } from "../../repository/user.repository.js";
import { CONTACTS_REPOSITORY } from "../../repository/contacts.repository.js";

const disconnectTimers = new Map();

export const onHandleUserConnected = async ({ userId, sessionId, socket }) => {
  addUserSocket(userId, sessionId, socket);

  if (disconnectTimers.has(userId)) { // Chống việc reload lại thì nó ảnh hưởng đến list online now
    clearTimeout(disconnectTimers.get(userId));
    disconnectTimers.delete(userId);
    return;
  }

  await onUpdateStatus(userId, {
    status: "online",
    lastSeenAt: null,
  });

  const currentUser = await USER_REPOSITORY.findById(userId);
  const initialOnlineContactIds = await CONTACT_SERVICE.onGetContactOfUserOnline(userId);

  emitOnlineUsers(userId, initialOnlineContactIds);

  await Promise.all(
    initialOnlineContactIds.map(async (contact) => {
      const contactRecord = await CONTACTS_REPOSITORY.findContactItem(contact.userId, userId);

      const displayName = (contactRecord?.nickname && contactRecord.nickname.trim())
        ? contactRecord.nickname
        : currentUser?.fullname;

      emitPresenceChanged(contact.userId, {
        userId,
        name: displayName,
        avatar: currentUser?.avatar,
        isOnline: true,
        lastSeenAt: null,
      });
    })
  );
};

export const onHandleUserDisconnected = async ({ userId, sessionId, socket }) => {
  removeUserSocket(userId, sessionId, socket.id);

  if (!isUserOnline(userId)) {
    if (disconnectTimers.has(userId)) {
      clearTimeout(disconnectTimers.get(userId));
    }

    const timer = setTimeout(async () => {
      disconnectTimers.delete(userId);

      // Check again to ensure user hasn't reconnected during the 2s delay
      if (isUserOnline(userId)) return;

      const lastSeenAt = new Date();

      await onUpdateStatus(userId, {
        status: "offline",
        lastSeenAt,
      });

      const activeCall = await CALL_REPOSITORY.findOne({
        participants: { $elemMatch: { userId: userId } },
        status: { $in: [callStatuses.ACTIVE, callStatuses.RINGING] },
      });

      if (activeCall) {
        await CALL_SERVICE.onEndCall({
          callId: activeCall._id.toString(),
          currentUserId: userId,
          reason: "missed",
        });
      }

      const currentUser = await USER_REPOSITORY.findById(userId);
      const onlineContacts = await CONTACT_SERVICE.onGetContactOfUserOnline(userId);

      // Phát sự kiện offline song song bằng Promise.all
      await Promise.all(
        onlineContacts.map(async (contact) => {
          const contactRecord = await CONTACTS_REPOSITORY.findContactItem(contact.userId, userId);

          const displayName = (contactRecord?.nickname && contactRecord.nickname.trim())
            ? contactRecord.nickname
            : currentUser?.fullname;

          emitPresenceChanged(contact.userId, {
            userId,
            name: displayName,
            avatar: currentUser?.avatar,
            isOnline: false,
            lastSeenAt,
          });
        })
      );
    }, 2000); // 2 second grace period

    disconnectTimers.set(userId, timer);
  }
};

