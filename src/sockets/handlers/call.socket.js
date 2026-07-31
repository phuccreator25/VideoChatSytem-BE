import { handleCallOffer } from "./call/offer.handler.js";
import { handleCallAnswer } from "./call/answer.handler.js";
import { handleCallIceCandidate } from "./call/ice.handler.js";
import { handleCallToggleMedia } from "./call/media.handler.js";
import { handleSpeedToText } from "./call/speedToText.handler.js";
import { handleCallReconnect, handleCallReconnectAnswer } from "./call/reconnect.handler.js";

export const registerCallSocket = (io, socket) => {
    socket.on("call:offer", (data) => handleCallOffer(io, socket, data));
    socket.on("call:answer", (data) => handleCallAnswer(io, socket, data));
    socket.on("call:ice-candidate", (data) => handleCallIceCandidate(io, socket, data));
    socket.on("call:toggle-media", (data) => handleCallToggleMedia(io, socket, data));
    socket.on("call:speed-to-text", (data) => handleSpeedToText(io, socket, data));
    socket.on("call:reconnect", (data) => handleCallReconnect(io, socket, data));
    socket.on("call:reconnect:answer", (data) => handleCallReconnectAnswer(io, socket, data))
};