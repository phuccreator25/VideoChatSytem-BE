import { emitCallReconnect, emitCallReconnectAnswer } from "../../emitters/call.emiter.js";

export const handleCallReconnect = (io, socket, data) => {
  const { conversationId, calleeId, callerId, offer } = data;

  if (!conversationId || !calleeId || !callerId || !offer) return;

  emitCallReconnect(calleeId, { conversationId, calleeId, callerId, offer });
};  

export const handleCallReconnectAnswer = (io, socket, data) => {
  const {conversationId, calleeId, callerId, answer} = data;

  if(!conversationId || !calleeId || !callerId || !answer) return;

  emitCallReconnectAnswer(callerId, {conversationId, calleeId, callerId, answer})
}