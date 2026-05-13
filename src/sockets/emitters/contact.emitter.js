import { emitToUser } from "../socketStore.js";

export const emitContactRemove = (receiverId, payload) => {
  emitToUser(receiverId, "contact:removed", payload);
};


