import { ObjectId } from "mongodb";
import { CALL_REPOSITORY } from "../../../repository/call.repository.js";
import { emitCallToggleMedia, emitCallToggleMediaError } from "../../emitters/call.emiter.js";
import { getSharingScreen, setSharingScreen, removeSharingScreen } from "../../socketStore.js";

export const handleCallToggleMedia = async (io, socket, data) => {
    try {
        const { callId, currentUserId, mediaType, enabled } = data;

        if (!callId || !currentUserId || !mediaType || typeof enabled !== "boolean") return;

        // Xử lý kiểm tra khóa duy nhất khi chia sẻ màn hình
        if (mediaType === "screen" && enabled) {
            const activeSharerId = getSharingScreen(callId);
            if (activeSharerId && String(activeSharerId) !== String(currentUserId)) {
                emitCallToggleMediaError(currentUserId, {
                    callId,
                    mediaType: "screen",
                    message: "The other party is sharing their screen.",
                });
                return;
            }
            setSharingScreen(callId, currentUserId);
        } else if (mediaType === "screen" && !enabled) {
            removeSharingScreen(callId);
        }

        const call = await CALL_REPOSITORY.findOne({
            _id: new ObjectId(callId)
        });

        if (!call) return;

        const otherUserId = call.participants.find((p) => p.userId !== currentUserId);
        if (!otherUserId) return;

        // Phát sự kiện toggle-media hợp nhất tới các participant còn lại
        emitCallToggleMedia(otherUserId.userId, {
            callId,
            userIdWhoToggled: currentUserId,
            mediaType,
            enabled,
        });

    } catch (error) {
        console.error("call:toggle-media error:", error);
        socket.emit("call:toggle-media:error", {
            message: error.message || "Toggle media failed",
        });
    }
};
