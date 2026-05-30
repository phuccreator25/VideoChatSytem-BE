import { emitToUser } from "../socketStore.js";

export const emitNewMessages = (receiverId, payload) => {
  emitToUser(receiverId, "messages:new", payload);
};

export const emitReceivedMessages = (receiverId, payload) => {
  emitToUser(receiverId, "messages:received", payload);
};




