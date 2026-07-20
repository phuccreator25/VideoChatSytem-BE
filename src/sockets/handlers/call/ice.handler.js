import { CONVERSATION_PARTICIPANT_REPOSITORY } from "../../../repository/conversationParticipant.repository.js";
import { emitCallCandidate } from "../../emitters/call.emiter.js";
import { addCallParticipants, getCallOtherParticipants } from "../../socketStore.js";

export const handleCallIceCandidate = async (io, socket, data) => {
    try {
        const { currentUserId, conversationId, candidate } = data;

        if (!currentUserId || !conversationId || !candidate) {
            socket.emit("call:ice-candidate:error", {
                message: "Missing conversationId or candidate",
            });
            return;
        }

        let targetUserIds = getCallOtherParticipants(conversationId, currentUserId);

        if (targetUserIds.length === 0) {
            const otherUserId = await CONVERSATION_PARTICIPANT_REPOSITORY.findOtherUserIdByConversation(conversationId, currentUserId);
            if (otherUserId) {
                targetUserIds = [otherUserId];
                addCallParticipants(conversationId, [currentUserId, otherUserId]);
            }
        }

        if (targetUserIds.length === 0) {
            socket.emit("call:ice-candidate:error", {
                message: "Conversation not found",
            });
            return;
        }

        targetUserIds.forEach((targetUserId) => {
            emitCallCandidate(targetUserId, {
                candidate,
                conversationId,
            });
        });
    } catch (error) {
        console.error("call:ice-candidate error:", error);

        socket.emit("call:ice-candidate:error", {
            message: error.message || "Add candidate failed",
        });
    }
};
