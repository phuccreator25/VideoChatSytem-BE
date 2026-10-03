import { emitToSession, emitToUser } from "../socketStore.js";

export const emitOnlineUsers = (userId, userIds) => {
 emitToUser(userId, "presence:online_users", userIds);
};

export const emitPresenceChanged = (userId, payload) => {
  emitToUser(userId, "presence:changed", payload);
};

export const emitAuthEventToUser = (userId, eventName, payload) => {
  emitToUser(userId, eventName, payload);
};

export const emitBanSessionEvent = (userId, sessionId, payload) => {
  emitToSession(userId, sessionId, "auth:session_banned", payload);
};

//BAN USER (ALL SESSION)
export const emitBanUserEvent = (userId, payload) => {
  emitToUser(userId, "auth:session_banned", payload);
};
