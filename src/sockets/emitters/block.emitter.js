import { emitToUser } from "../socketStore.js";

export const emitBlockUser = (receiverId, payload) => {
  emitToUser(receiverId, "block:user", payload);
};

export const emitUnblockUser = (receiverId, payload) => {
  emitToUser(receiverId, "unblock:user", payload);
};

