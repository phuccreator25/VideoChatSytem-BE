import { CALL_REPOSITORY } from '../repository/call.repository.js';
import { callStatuses, participantRoles, participantStatuses } from '../data/call.data.js';
import { ObjectId } from 'mongodb';
import { emitAcceptCall, emitCallEnd } from '../sockets/emitters/call.emiter.js';
import { endCallSession, isUserOnline, removeSharingScreen, clearCallTimer, removePendingOffer } from '../sockets/socketStore.js';
import { messageTypes } from '../data/message.data.js';
import { MESSAGE_DELIVERY_REPOSITORY } from '../repository/messageDeliveries.repository.js';
import { MESSAGE_REPOSITORY } from '../repository/message.repository.js';
import { client } from '../config/database.js';
import { emitNewMessages } from '../sockets/emitters/messages.emitter.js';
import axios from 'axios';
import env from '../config/env.js';
import { GEMINI_SERVICE } from './AI/gemini.service.js';

const onGetTurnCredentials = async () => {
    try {
        // Gọi API của Metered để lấy danh sách iceServers xịn, đã được xác thực sẵn
        const response = await axios.get("https://nguyentruongphuc.metered.live/api/v1/turn/credentials?apiKey=c899fd119eb94b17b7a94ea8525dd5be2946");

        return {
            success: true,
            iceServers: response.data
        };
    } catch (error) {
        console.error("Lỗi khi lấy thông tin TURN từ Metered:", error);
        // Fallback về STUN miễn phí để tránh crash app
        return {
            success: true,
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        };
    }
};

const onMakeCall = async ({ data }) => {
    const { conversationId, callerId, calleeId, offer, type } = data;

    if (!callerId || !calleeId || !offer) {
        return {
            success: false,
            message: "Missing callerId or calleeId or offer",
        };
    }

    //Nếu có cuộc gọi đang diễn ra thì không cho gọi
    const activeCall = await CALL_REPOSITORY.findOne({
        participants: {
            $elemMatch: {
                userId: calleeId.toString(),
                status: { $in: [callStatuses.ACTIVE, callStatuses.RINGING] }
            }
        }
    });

    if (activeCall) {
        throw new Error("User is already in a call");
    }

    //Triển khai sẽ nhận Array userid khi groupCall
    const newCallData = {
        conversationId,
        type,
        status: callStatuses.RINGING,
        startedAt: new Date(),
        endedAt: null,
        participants: [
            {
                userId: callerId,
                role: participantRoles.CALLER,
                joinStatus: participantStatuses.ACCEPTED,
                joinedAt: new Date(),
            },
            {
                userId: calleeId,
                role: participantRoles.CALLEE,
                joinStatus: participantStatuses.PENDING,
                joinedAt: null,
            },
        ],
    }

    const newCall = await CALL_REPOSITORY.createOne(newCallData)

    return newCall;
}

const onEndCall = async ({ callId, currentUserId, reason = null }) => {
    const session = client.startSession();
    try {
        session.startTransaction();

        if (!callId || typeof callId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(callId)) {
            throw new Error(`Invalid callId: ${JSON.stringify(callId)}. Must be a 24-character hex string.`);
        }

        const call = await CALL_REPOSITORY.findOne({ _id: new ObjectId(callId) });

        if (!call) { throw new Error("Call not found"); }

        if (call.status !== callStatuses.RINGING && call.status !== callStatuses.ACTIVE) {
            return call;
        }

        // Tìm participant hiện tại thực hiện hành động cúp máy
        const currentParticipant = call.participants.find(
            (participant) => participant.userId.toString() === currentUserId.toString()
        );

        if (!currentParticipant) {
            throw new Error("Current user is not a participant in this call");
        }

        // Cập nhật trạng thái rời cuộc gọi của participant này
        if (currentParticipant.joinStatus === participantStatuses.PENDING) {
            currentParticipant.joinStatus = participantStatuses.REJECTED;
        } else if (currentParticipant.joinStatus === participantStatuses.ACCEPTED) {
            if (currentParticipant.leftAt === null) {
                currentParticipant.leftAt = new Date();
            }
        }

        // Đếm số participant còn lại đang hoạt động
        const activeParticipants = call.participants.filter(
            (p) => p.joinStatus !== participantStatuses.REJECTED &&
                p.joinStatus !== participantStatuses.MISSED &&
                p.leftAt === null
        );

        let updatedStatus = call.status;
        let shouldCloseUI = false;

        // Nếu số người hoạt động còn lại <= 1, đóng cuộc gọi hoàn toàn
        if (activeParticipants.length <= 1) {
            shouldCloseUI = true;

            const hasJoined = call.participants.some(
                p => p.role === participantRoles.CALLEE &&
                    (p.joinStatus === participantStatuses.ACCEPTED || p.joinedAt !== null)
            );

            updatedStatus = hasJoined ? callStatuses.COMPLETED : callStatuses.REJECTED;
            call.endedAt = new Date();

            call.participants.forEach(p => {
                if (p.joinStatus === participantStatuses.ACCEPTED && p.leftAt === null) {
                    p.leftAt = new Date();
                }
                if (p.joinStatus === participantStatuses.PENDING) {
                    p.joinStatus = participantStatuses.MISSED;
                }
            });
        }

        // Cập nhật trạng thái Call vào Database
        await CALL_REPOSITORY.updateOne({
            _id: new ObjectId(callId)
        }, {
            $set: {
                status: updatedStatus,
                endedAt: call.endedAt,
                updatedAt: new Date(),
                participants: call.participants
            }
        }, session);

        let createdCallMessage = null;
        const hasTranscript = Array.isArray(call.transcript) && call.transcript.length > 0;

        // Ghi MESSAGE & DELIVERY KHI CUỘC GỌI HOÀN TOÀN KẾT THÚC (shouldCloseUI = true)
        if (shouldCloseUI) {
            const callerId = call.participants[0]?.userId;
            const isCompleted = updatedStatus === callStatuses.COMPLETED;
            const durationSec = isCompleted && call.endedAt && call.startedAt
                ? Math.max(0, Math.floor((call.endedAt - call.startedAt) / 1000))
                : 0;

            // Xác định chính xác trạng thái log cuộc gọi (completed, cancelled, rejected, missed)
            let callLogStatus = updatedStatus;

            if (!isCompleted) {
                if (reason === 'timeout' || reason === 'missed') {
                    callLogStatus = callStatuses.MISSED;
                } else {
                    const callerParticipant = call.participants.find(p => p.role === participantRoles.CALLER);
                    const isCallerEnd = callerParticipant && callerParticipant.userId.toString() === currentUserId.toString();
                    const isCalleeReject = currentParticipant && currentParticipant.role === participantRoles.CALLEE;

                    if (isCallerEnd) {
                        callLogStatus = callStatuses.CANCELLED;
                    } else if (isCalleeReject) {
                        callLogStatus = callStatuses.REJECTED;
                    } else {
                        callLogStatus = callStatuses.MISSED;
                    }
                }
            }

            // Tạo Message Log Cuộc Gọi
            createdCallMessage = await MESSAGE_REPOSITORY.createOne({
                conversationId: call.conversationId,
                senderId: callerId,
                messageType: messageTypes.CALL,
                type: 'call',
                callInfo: {
                    callId: callId,
                    callType: call.type,
                    status: callLogStatus,
                    duration: durationSec,
                    hasTranscript: hasTranscript,
                },
                content: `${call.type === "video" ? "Video call" : "Voice call"} ${callLogStatus}`,
                status: 'sent',
                createdAt: new Date(),
            }, session);

            // Tạo Message Delivery cho các thành viên khác (Hỗ trợ 1-1 và Group Call)
            const otherParticipants = call.participants.filter(
                (p) => p.userId.toString() !== callerId.toString()
            );

            for (const recipient of otherParticipants) {
                await MESSAGE_DELIVERY_REPOSITORY.createOne({
                    messageId: createdCallMessage._id.toString(),
                    userId: recipient.userId,
                    deliveredAt: isUserOnline(recipient.userId) ? new Date() : null,
                    conversationId: call.conversationId,
                    readAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }, session);
            }
        }

        await session.commitTransaction();
        session.endSession();

        if (shouldCloseUI && createdCallMessage) {
            const messageCreated = await MESSAGE_REPOSITORY.findMessageAfterSend(createdCallMessage._id);

            call.participants.forEach((participant) => {
                emitNewMessages(participant.userId, messageCreated);
            });
        }

        const finalCallData = await CALL_REPOSITORY.findOne({ _id: new ObjectId(callId) });

        // Xác định lý do cuộc gọi kết thúc
        let finalReason = reason
        if (!finalReason && call.status === callStatuses.RINGING) { // trong trường hợp ring user bấm tay thủ công
            const callerParticipant = call.participants.find(p => p.role === participantRoles.CALLER);
            const isCallerEnd = callerParticipant && callerParticipant.userId.toString() === currentUserId.toString();
            finalReason = isCallerEnd ? 'cancelled' : 'rejected';
        }

        // Đồng bộ Socket cho các bên
        if (shouldCloseUI) {
            endCallSession(call.conversationId);
            removeSharingScreen(callId);
            clearCallTimer(callId);
            removePendingOffer(currentUserId);
        }

        call.participants.forEach((participant) => {
            emitCallEnd(participant.userId, {
                callId: callId,
                userIdWhoLeft: currentUserId,
                shouldCloseUI: shouldCloseUI,
                updatedCall: finalCallData,
                reason: finalReason
            });
        });

        return finalCallData;

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const onAcceptCall = async ({ callId, currentUserId }) => {
    try {
        if (!callId || typeof callId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(callId)) {
            throw new Error(`Invalid callId: ${JSON.stringify(callId)}. Must be a 24-character hex string.`);
        }

        const call = await CALL_REPOSITORY.findOne({
            _id: new ObjectId(callId)
        });

        if (!call) {
            throw new Error("Call not found");
        }

        if (call.status !== callStatuses.RINGING) {
            throw new Error("Call is not ringing");
        }

        const currentParticipant = call.participants.find(
            (p) => p.userId.toString() === currentUserId.toString()
        );

        if (!currentParticipant) {
            throw new Error("Current user is not a participant in this call");
        }

        if (currentParticipant.joinStatus !== participantStatuses.PENDING) {
            throw new Error("Current user is not a participant in this call");
        }

        currentParticipant.joinStatus = participantStatuses.ACCEPTED;
        currentParticipant.joinedAt = new Date();

        await CALL_REPOSITORY.updateOne({
            _id: new ObjectId(callId)
        }, {
            $set: {
                participants: call.participants,
                updatedAt: new Date(),
                status: callStatuses.ACTIVE
            }
        });

        const finalCallData = await CALL_REPOSITORY.findOne({ _id: new ObjectId(callId) });

        // Clear pending call timers & offers when call is accepted
        clearCallTimer(callId);
        removePendingOffer(currentUserId);

        // 6. Phát sự kiện socket cho tất cả các bên tham gia để đồng bộ UI
        call.participants.forEach((participant) => {
            emitAcceptCall(participant.userId, {
                callId: callId,
                updatedCall: finalCallData,
                userIdWhoAccepted: currentUserId,
            });
        });

        return finalCallData;
    } catch (error) {
        throw error;
    }
};

const onSpeedToTextCall = async ({ callId, transcript, currentUserId }) => {
    try {
        if (!callId || typeof callId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(callId)) {
            throw new Error(`Invalid callId: ${JSON.stringify(callId)}`);
        }

        if (!transcript) return false;

        const transcriptArray = Array.isArray(transcript) ? transcript : [transcript];
        if (transcriptArray.length === 0) return false;

        const call = await CALL_REPOSITORY.findOne({ _id: new ObjectId(callId) });
        if (!call) {
            throw new Error(`Không tìm thấy Cuộc gọi với ID: ${callId}`);
        }

        let updateOperation;

        if (!Array.isArray(call.transcript)) {
            updateOperation = {
                $set: { 
                    transcript: transcriptArray,
                    updatedAt: new Date()
                }
            };
        } else {
            updateOperation = {
                $push: { transcript: { $each: transcriptArray } },
                $set: { updatedAt: new Date() }
            };
        }

        const result = await CALL_REPOSITORY.updateOne(
            { 
                _id: new ObjectId(callId),
                "participants.userId": currentUserId.toString() 
            },
            updateOperation
        );

        if (result.matchedCount === 0) {
            throw new Error(`User ${currentUserId} không phải là participant trong cuộc gọi ${callId}`);
        }

        console.log(` Đã lưu ${transcriptArray.length} câu thoại vào DB thành công!`);
        return true;

    } catch (error) {
        console.error("Lỗi trong onSpeedToTextCall:", error);
        throw error;
    }
};

const onGenerateCallAISummary = async ({ callId }) => {
    const session = client.startSession();

    try {
        if (!callId || typeof callId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(callId)) {
            throw new Error(`Invalid callId: ${JSON.stringify(callId)}. Must be a 24-character hex string.`);
        }

        const call = await CALL_REPOSITORY.findOne({ _id: new ObjectId(callId) });
        if (!call) {
            throw new Error("Call not found");
        }

        if (!Array.isArray(call.transcript) || call.transcript.length === 0) {
            throw new Error("Cuộc gọi chưa có dữ liệu hội thoại (transcript) để tóm tắt.");
        }

        // Gọi dịch vụ AI module hóa độc lập
        const aiSummary = await GEMINI_SERVICE.generateCallSummary(call.transcript);

        await session.startTransaction();
        // Cập nhật DB song song bằng Promise.all để tối ưu tốc độ
        await Promise.all([
            MESSAGE_REPOSITORY.updateOne(
                { 'callInfo.callId': callId },
                { $set: { 'callInfo.aiSummary': aiSummary } },
                session
            ),
            CALL_REPOSITORY.updateOne(
                { _id: new ObjectId(callId) },
                {
                    $set: {
                        aiSummary: aiSummary,
                        updatedAt: new Date()
                    }
                },
                session
            )
        ]);
        await session.commitTransaction();
        return aiSummary;

    } catch (error) {
        if (error?.response?.status === 429) {
            throw new Error("Hệ thống Gemini AI đang tạm thời quá tải (Rate Limit). Vui lòng thử lại sau!");
        }
        console.error("Lỗi trong onGenerateCallAISummary:", error?.response?.data || error.message);
        throw error;
    } finally {
        if (session) {
            await session.endSession();
        }
    }
};

export const CALL_SERVICE = {
    onGetTurnCredentials,
    onMakeCall,
    onEndCall,
    onAcceptCall,
    onSpeedToTextCall,
    onGenerateCallAISummary
};