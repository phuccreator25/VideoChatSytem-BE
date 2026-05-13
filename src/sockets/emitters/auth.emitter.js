import { emitToUser } from "../socketStore.js";

export const emitOnlineUsers = (userId, userIds) => {
 emitToUser(userId, "presence:online_users", userIds);
};

export const emitPresenceChanged = (userId, payload) => {
  emitToUser(userId, "presence:changed", payload);
};

export const emitAuthEventToUser = (userId, eventName, payload) => {
  emitToUser(userId, eventName, payload);
};
