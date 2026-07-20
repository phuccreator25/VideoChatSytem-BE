import { emitToUser } from "../socketStore.js"

export const emitCallOffer = (receivedId, payload) => {
    emitToUser(receivedId, "call:offer:success", payload);
}

export const emitCallInitiated = (receivedId, payload) => {
    emitToUser(receivedId, "call:initiated", payload);
}

export const emitCallCandidate = (receivedId, payload) => {
    emitToUser(receivedId, "call:ice-candidate", payload);
}

export const emitCallAnswer = (receivedId, payload) => {
    emitToUser(receivedId, "call:answer", payload);
}

export const emitCallEnd = (receivedId, payload) => {
    emitToUser(receivedId, "call:end", payload);
}

export const emitRejectCall = (receivedId, payload) => {
    emitToUser(receivedId, "call:reject", payload);
}

export const emitAcceptCall = (receivedId, payload) => {
    emitToUser(receivedId, "call:accept", payload);
}

export const emitCallOffline = (receivedId, payload) => {
    emitToUser(receivedId, "call:offline", payload);
}

export const emitCallRinging = (receivedId, payload) => {
    emitToUser(receivedId, "call:ringing", payload);
}

export const emitCallToggleMedia = (receivedId, payload) => {
    emitToUser(receivedId, "call:toggle-media", payload);
}

export const emitCallToggleMediaError = (receivedId, payload) => {
    emitToUser(receivedId, "call:toggle-media:error", payload);
}

