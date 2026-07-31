import env from "../config/env.js";
import { CALL_REPOSITORY } from "../repository/call.repository.js";
import { ObjectId } from "mongodb";

export const onIngestionDataCall = async ({ callId, }) => {
    try {
        const call = await CALL_REPOSITORY.findOne({_id: new ObjectId(callId)})

        if(!call) {
            throw new Error('Call not found when send webhook ingestion');
        }

        const participantUserIds = call.participants.map(p => p.userId.toString());

        await axios.post(env.URL_INGESTION_CALL, {
            callId: callId,
            conversationId: call.conversationId.toString(),
            callType: call.type,
            startedAt: call.startedAt,
            endedAt: call.endedAt,
            participantUserIds: participantUserIds,
            transcript: call.transcript
        }, {
            timeout: 5000
        });
    } catch (error) {
        console.error(`[RAG Webhook Error] Failed for callId ${callId}:`, error.message);
    }
}   