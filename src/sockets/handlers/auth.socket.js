import { CONTACTS_REPOSITORY } from "../../repository/contacts.repository.js";
import { USER_REPOSITORY } from "../../repository/user.repository.js";
import { emitOnlineUsers, emitPresenceChanged } from "../emitters/auth.emitter.js";
import { addUserSocket, isUserOnline, removeUserSocket } from "../socketStore.js";

const getContactsOfUser = async (userId) => {
  const filter = {
    userId: userId,
  };

  const contactIds = await CONTACTS_REPOSITORY.findUserOnline(filter);
  console.log(contactIds);

  return contactIds;
};

export const registerAuthSocket = async (io, socket) => {
  const userId = socket.userId;
  const sessionId = socket.sessionId;

  if (!userId || !sessionId) return;

  addUserSocket(userId, sessionId, socket);

  await USER_REPOSITORY.updateById({
    _id: userId,
    data: {
      status: "online",
    },
  });

  const initialOnlineContactIds = await getContactsOfUser(userId);
  emitOnlineUsers(userId, initialOnlineContactIds);

  initialOnlineContactIds.forEach((contactUserId) => {
    emitPresenceChanged(contactUserId, {
      userId,
      isOnline: true,
      lastSeenAt: null,
    });
  });

  socket.on("disconnect", async () => {
    removeUserSocket(userId, sessionId, socket.id);

    if (!isUserOnline(userId)) {
      const lastSeenAt = new Date();

      await USER_REPOSITORY.updateById({
        _id: userId,
        data: {
          status: "offline",
          lastSeenAt,
        },
      });

      const onlineContactIds = await getContactsOfUser(userId);

      onlineContactIds.forEach((contactUserId) => {
        emitPresenceChanged(contactUserId, {
          userId,
          isOnline: false,
          lastSeenAt,
        });
      });
    }

    const latestOnlineContactIds = await getContactsOfUser(userId);
    emitOnlineUsers(userId, latestOnlineContactIds);
  });
};
