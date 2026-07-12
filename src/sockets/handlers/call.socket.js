import { ObjectId } from "mongodb";
import { CALL_REPOSITORY } from "../../repository/call.repository.js";
import { CONTACTS_REPOSITORY } from "../../repository/contacts.repository.js";
import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../../repository/conversationParticipant.repository.js";
import { CALL_SERVICE } from "../../service/call.service.js";
import { emitCallAnswer, emitCallCandidate, emitCallCloseAudio, emitCallInitiated, emitCallOffer, emitCloseVideoCall } from "../emitters/call.emiter.js";
import { isUserOnline } from "../socketStore.js";

export const registerCallSocket = (io, socket) => {
    socket.on("call:offer", async (data) => {
        try {
            const { conversationId, callerId, calleeId, offer, type } = data;

            if (!callerId || !calleeId || !offer || !conversationId || !type) {
                socket.emit("call:offer:error", {
                    message: "Missing callerId or calleeId or offer or conversationId or type",
                });
                return;
            }

            const result = await CALL_SERVICE.onMakeCall({ data })

            const callerData = await CONTACTS_REPOSITORY.findContactDetails(calleeId, callerId);

            const callerInfo = callerData ? {
                userId: callerData.userId,
                avatar: callerData.avatar,
                fullname: callerData.fullname,
                nickname: callerData.nickname,
                isOnline: "online",
            } : null;

            const isOnlineCallee = isUserOnline(calleeId);

            if (isOnlineCallee) {
                emitCallOffer(calleeId, {
                    offer,
                    callerId,
                    calleeId,
                    type,
                    callId: result.insertedId.toString(),
                    conversationId,
                    callerInfo
                });
            }

            emitCallInitiated(callerId, {
                callId: result.insertedId.toString(),
            });

        } catch (error) {
            console.error("call:offer error:", error);

            socket.emit("call:offer:error", {
                message: error.message || "Make call failed",
            });
        }
    });

    socket.on("call:answer", async (data) => {
        try {
            const { conversationId, callerId, answer } = data;

            if (!conversationId || !callerId || !answer) {
                emitCallAnswer(callerId, {
                    message: "Missing conversationId or callerId or answer",
                });
                return;
            }

            emitCallAnswer(callerId, {
                answer,
                conversationId,
            });

        } catch (error) {
            console.error("call:answer error:", error);

            socket.emit("call:answer:error", {
                message: error.message || "Answer call failed",
            });
        }
    })

    socket.on("call:ice-candidate", async (data) => {
        try {
            const { currentUserId, conversationId, candidate } = data;

            if (!currentUserId || !conversationId || !candidate) {
                socket.emit("call:ice-candidate:error", {
                    message: "Missing conversationId or candidate",
                });
                return;
            }

            const otherUserId = await CONVERSATION_PARTICIPANT_REPOSITORY.findOtherUserIdByConversation(conversationId, currentUserId);

            if (!otherUserId) {
                socket.emit("call:ice-candidate:error", {
                    message: "Conversation not found",
                });
                return;
            }

            emitCallCandidate(otherUserId, {
                candidate,
                conversationId,
            });
        } catch (error) {
            console.error("call:ice-candidate error:", error);

            socket.emit("call:ice-candidate:error", {
                message: error.message || "Add candidate failed",
            });
        }
    });

    socket.on('call:close-video', async (data) => {
        try {
            const { callId, currentUserId } = data;

            if (!callId || !currentUserId) return;

            const call = await CALL_REPOSITORY.findOne({
                _id: new ObjectId(callId)
            });

            if (!call) return;

            const otherUserId = call.participants.find((p) => p.userId !== currentUserId);

            emitCloseVideoCall(otherUserId.userId, {
                callId,
                userIdWhoClose: currentUserId,
            });
        } catch (error) {
            console.error("call:close-video error:", error);

            socket.emit('call:close-video:error', {
                message: error.message || "Close video call failed",
            });
        }
    })

    socket.on('call:close-audio', async (data) => {
        try {
            const { callId, currentUserId } = data;

            if (!callId || !currentUserId) return;

            const call = await CALL_REPOSITORY.findOne({
                _id: new ObjectId(callId)
            });

            if (!call) return;

            const otherUserId = call.participants.find((p) => p.userId !== currentUserId);

            emitCallCloseAudio(otherUserId.userId, {
                callId,
                userIdWhoClose: currentUserId,
            });
        } catch (error) {
            console.error("call:close-audio error:", error);

            socket.emit('call:close-audio:error', {
                message: error.message || "Close audio call failed",
            });
        }
    })
}; 
