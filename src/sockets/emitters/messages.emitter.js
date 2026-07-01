import { emitToUser } from "../socketStore.js";

export const emitNewMessages = (receiverId, payload) => {
  emitToUser(receiverId, "messages:new", payload);
};

export const emitReceivedMessages = (receiverId, payload) => {
  emitToUser(receiverId, "messages:received", payload);
};

export const emitPinMessages = (receiverId, payload) => {
  emitToUser(receiverId, "messages:pinMessage", payload);
};

export const emitDeletePinMessages = (receiverId, payload) => {
  emitToUser(receiverId, "messages:delete-pinMessage", payload);
};

export const emitReactEmotion = (receiverId, payload) => {
  emitToUser(receiverId, "messages:react-emotion", payload);
};

export const emitUnReactEmotion = (receiverId, payload) => {
  emitToUser(receiverId, "messages:unreact-emotion", payload);
};

export const emitDeleteMessage = (receiverId, payload) => {
  emitToUser(receiverId, "messages:delete", payload);
};

export const emitRevokeMessage = (receiverId, payload) => {
  emitToUser(receiverId, "messages:revoke", payload);
};

export const emitUpdateLinkPreview = (receiverId, payload) => {
  emitToUser(receiverId, "messages:updateLinkPreview", payload);
};