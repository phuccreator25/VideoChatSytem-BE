import { emitToUser } from "../socketStore.js";

export const emitInvitationReceived = (receiverId, payload) => {
  emitToUser(receiverId, "invitation:received", payload);
};

export const emitInvitationCancel = (receiverId, payload) => {
  emitToUser(receiverId, "invitation:cancelled", payload);
};

export const emitInvitationAccept = (receiverId, payload) => {
  emitToUser(receiverId, "invitation:accepted", payload);
};

export const emitInvitationDecline = (receiverId, payload) => {
  emitToUser(receiverId, "invitation:declined", payload);
};

export const emitInvitationSent = (receiverId, payload) => {
  emitToUser(receiverId, "invitation:sent", payload);
};

