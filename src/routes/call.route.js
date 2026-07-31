import { Router } from "express";
import { CALL_CONTROLLER } from "../controlles/call.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const callRouter = Router()

callRouter.get('/calls/turn-credentials', authMiddleware, CALL_CONTROLLER.onGetTurnCredentials)

callRouter.post('/calls/end-call', authMiddleware, CALL_CONTROLLER.onEndCall)

callRouter.post('/calls/accept-call', authMiddleware, CALL_CONTROLLER.onAcceptCall)

callRouter.post('/calls/generate-summary', authMiddleware, CALL_CONTROLLER.onGenerateCallAISummary)

callRouter.post('/calls/:callId/vector-status', CALL_CONTROLLER.updateVectorStatus)

callRouter.get('/calls/pending-vector', CALL_CONTROLLER.onGetPendingVectorCalls)

callRouter.post('/calls/query-chat', CALL_CONTROLLER.onQueryChat)

export default callRouter
