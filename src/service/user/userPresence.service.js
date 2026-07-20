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

export const onHandleUserConnected = async ({ userId, sessionId, socket }) => {
  addUserSocket(userId, sessionId, socket);

  await onUpdateStatus(userId, {
    status: "online",
    lastSeenAt: null,
  });

  const initialOnlineContactIds =
    await CONTACT_SERVICE.onGetContactOfUserOnline(userId);

  emitOnlineUsers(userId, initialOnlineContactIds);

  initialOnlineContactIds.forEach((contactUserId) => {
    emitPresenceChanged(contactUserId, {
      userId,
      isOnline: true,
      lastSeenAt: null,
    });
  });

  console.log("okoko ", userId);
};

export const onHandleUserDisconnected = async ({ userId, sessionId, socket }) => {
  removeUserSocket(userId, sessionId, socket.id);

  if (!isUserOnline(userId)) {
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

    const onlineContactIds =
      await CONTACT_SERVICE.onGetContactOfUserOnline(userId);

    onlineContactIds.forEach((contactUserId) => {
      emitPresenceChanged(contactUserId, {
        userId,
        isOnline: false,
        lastSeenAt,
      });
    });
  }

  const latestOnlineContactIds =
    await CONTACT_SERVICE.onGetContactOfUserOnline(userId);

  emitOnlineUsers(userId, latestOnlineContactIds);
};
