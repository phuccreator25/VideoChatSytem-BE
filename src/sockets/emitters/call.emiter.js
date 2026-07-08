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

