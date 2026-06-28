import { emitToUser } from "../socketStore.js";

export const emitContactRemove = (receiverId, payload) => {
  emitToUser(receiverId, "contact:removed", payload);
};

export const emitContactUpdateNickName = (receiverId, payload) => {
  emitToUser(receiverId, "contact:updateNickName", payload);
};



