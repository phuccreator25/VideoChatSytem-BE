import { speedToTextQueue } from "../../../queues/uploadFileQueue.js";
import { CALL_SERVICE } from "../../../service/call.service.js";

export const handleSpeedToText = async (io, socket, data) => {
    try {
        const { callId, speakerName, text, timestamp } = data;
        const currentUserId = socket.userId;

        if (!callId || !text || !timestamp) {
            console.warn('[Speech-to-Text] Dữ liệu không đủ:', data);
            return;
        }

        const transcriptItem = {
            speakerName: speakerName || 'User', // Fallback nếu không có tên người nói
            text: text.trim(),
            timestamp
        };

        speedToTextQueue.add('process-speed-to-text', {
            callId,
            transcript: transcriptItem,
            currentUserId
        });

    } catch (error) {
        console.error('[Speech-to-Text] Unexpected Error:', error);
    }
};