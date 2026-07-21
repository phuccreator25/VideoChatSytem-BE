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

const onSpeedToTextCall = async (req, res, next) => {
    try {
        const { callId, transcript } = req.body
        const currentUserId = req.user.id

        await CALL_SERVICE.onSpeedToTextCall({ callId, transcript, currentUserId })

        return res.status(200).json({
            data: true
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

export const CALL_CONTROLLER = {
    onGetTurnCredentials,
    onEndCall,
    onAcceptCall,
    onSpeedToTextCall,
    onGenerateCallAISummary
}