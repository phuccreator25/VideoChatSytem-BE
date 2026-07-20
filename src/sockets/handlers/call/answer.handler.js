import { emitCallAnswer } from "../../emitters/call.emiter.js";
import { removePendingOffer } from "../../socketStore.js";

export const handleCallAnswer = async (io, socket, data) => {
    try {
        const { conversationId, callerId, answer } = data;

        if (!conversationId || !callerId || !answer) {
            emitCallAnswer(callerId, {
                message: "Missing conversationId or callerId or answer",
            });
            return;
        }

        removePendingOffer(callerId);

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
};
