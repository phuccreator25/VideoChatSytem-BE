import { CALL_SERVICE } from "../service/call.service.js";

const onGetTurnCredentials = async (req, res, next) => {
    try {
        const turnCredentials = await CALL_SERVICE.onGetTurnCredentials()

        return res.status(200).json({
            data: turnCredentials
        })
    } catch (error) {
        next(error)
    }
}

const onEndCall = async (req, res, next) => {
    try {
        const { callId } = req.body
        const currentUserId = req.user.id

        const call = await CALL_SERVICE.onEndCall({ callId, currentUserId })

        return res.status(200).json({
            data: call
        })
    } catch (error) {
        next(error)
    }
}

const onAcceptCall = async (req, res, next) => {
    try {
        const { callId } = req.body
        const currentUserId = req.user.id

        const call = await CALL_SERVICE.onAcceptCall({ callId, currentUserId })

        return res.status(200).json({
            data: call
        })
    } catch (error) {
        next(error)
    }
}

const onGenerateCallAISummary = async (req, res, next) => {
    try {
        const { callId } = req.body
        const currentUserId = req.user.id

        const call = await CALL_SERVICE.onGenerateCallAISummary({ callId, currentUserId })

        return res.status(200).json({
            data: call
        })
    } catch (error) {
        next(error)
    }
}

const updateVectorStatus = async (req, res) => {
    const { callId } = req.params;
    const { status } = req.body;

    console.log('status', status);
    console.log('callId', callId);

    await CALL_SERVICE.onUpdateVectorStatus({ callId, status })

    return res.json({ success: true, message: `Updated vector status to ${status}` });
};

const onGetPendingVectorCalls = async (req, res, next) => {
    try {
        const calls = await CALL_SERVICE.onGetPendingVectorCalls()

        return res.status(200).json({
            data: calls
        })
    } catch (error) {
        next(error)
    }
}

const onQueryChat = async (req, res, next) => {
    try {
        const { question, userId } = req.body;

        const result = await CALL_SERVICE.onQueryChat({ question, userId });

        return res.status(200).json({
            data: result
        });
    } catch (error) {
        next(error);
    }
}

export const CALL_CONTROLLER = {
    onGetTurnCredentials,
    onEndCall,
    onAcceptCall,
    onGenerateCallAISummary,
    updateVectorStatus,
    onGetPendingVectorCalls,
    onQueryChat
}