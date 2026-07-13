import { CALL_REPOSITORY } from '../repository/call.repository.js';
import { callStatuses, participantRoles, participantStatuses } from '../data/call.data.js';
import { ObjectId } from 'mongodb';
import { emitAcceptCall, emitCallEnd } from '../sockets/emitters/call.emiter.js';
import axios from 'axios'

export const onGetTurnCredentials = async () => {
    try {
        // Gọi API của Metered để lấy danh sách iceServers xịn, đã được xác thực sẵn
        const response = await axios.get("https://nguyentruongphuc.metered.live/api/v1/turn/credentials?apiKey=c899fd119eb94b17b7a94ea8525dd5be2946");

        console.log("response from metered: ", response);
        console.log("response data from metered: ", response.data);


        return {
            success: true,
            // Kết quả trả về của Metered là một mảng iceServers chứa sẵn username/credential hợp lệ
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

//XỬ LÝ TIẾP ENDCALL 
const onEndCall = async ({ callId, currentUserId }) => {
    if (!callId || typeof callId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(callId)) {
        throw new Error(`Invalid callId: ${JSON.stringify(callId)}. Must be a 24-character hex string.`);
    }

    const call = await CALL_REPOSITORY.findOne({
        _id: new ObjectId(callId)
    });

    if (!call) { throw new Error("Call not found") }

    if (call.status !== callStatuses.RINGING && call.status !== callStatuses.ACTIVE) {
        throw new Error("Call is not active or already ended")
    }

    // 1. Tìm participant hiện tại thực hiện hành động cúp máy
    const currentParticipant = call.participants.find(
        (participant) => participant.userId.toString() === currentUserId.toString()
    );

    if (!currentParticipant) {
        throw new Error("Current user is not a participant in this call")
    }

    // 2. Cập nhật trạng thái rời cuộc gọi của participant này
    if (currentParticipant.joinStatus === participantStatuses.PENDING) {
        currentParticipant.joinStatus = participantStatuses.REJECTED;
        // Bấm từ chối lúc reo chuông thì không ghi nhận leftAt vì chưa từng tham gia
    } else if (currentParticipant.joinStatus === participantStatuses.ACCEPTED) {
        if (currentParticipant.leftAt === null) {
            currentParticipant.leftAt = new Date();
        }
    }

    // 3. Đếm số participant còn lại đang hoạt động (không bị rejected/missed và chưa rời đi)
    const activeParticipants = call.participants.filter(
        (p) => p.joinStatus !== participantStatuses.REJECTED &&
            p.joinStatus !== participantStatuses.MISSED &&
            p.leftAt === null
    );

    let updatedStatus = call.status;
    let shouldCloseUI = false;

    // 4. Nếu số người hoạt động còn lại <= 1, đóng cuộc gọi hoàn toàn
    if (activeParticipants.length <= 1) {
        shouldCloseUI = true;

        // Nếu có bất cứ ai reject (từ chối cuộc gọi lúc reo chuông) -> REJECTED, ngược lại là COMPLETED
        const hasJoined = call.participants.some(
            p => p.role === participantRoles.CALLEE &&
                (p.joinStatus === participantStatuses.ACCEPTED || p.joinedAt !== null)
        );

        updatedStatus = hasJoined ? callStatuses.COMPLETED : callStatuses.REJECTED;

        call.endedAt = new Date();

        // Ghi nhận leftAt cho tất cả những người đã ACCEPTED nhưng chưa kịp cúp máy để làm sạch DB
        call.participants.forEach(p => {
            if (p.joinStatus === participantStatuses.ACCEPTED && p.leftAt === null) {
                p.leftAt = new Date();
            }
            // Cực kỳ nên thêm dòng này:
            if (p.joinStatus === participantStatuses.PENDING) {
                p.joinStatus = participantStatuses.MISSED; // Hoặc CANCELLED tùy bạn định nghĩa
            }
        });
    }

    // 5. Cập nhật vào Database
    const updatedCall = await CALL_REPOSITORY.updateOne({
        _id: new ObjectId(callId)
    }, {
        $set: {
            status: updatedStatus,
            endedAt: call.endedAt,
            updatedAt: new Date(),
            participants: call.participants
        }
    });

    const finalCallData = await CALL_REPOSITORY.findOne({ _id: new ObjectId(callId) });

    // Xác định lý do cuộc gọi kết thúc (ended: cúp máy bình thường, rejected: bị từ chối, cancelled: người gọi tự hủy)
    let reason = 'ended';
    if (call.status === callStatuses.RINGING) {
        const callerParticipant = call.participants.find(p => p.role === participantRoles.CALLER);
        const isCallerEnd = callerParticipant && callerParticipant.userId.toString() === currentUserId.toString();

        if (isCallerEnd) {
            reason = 'cancelled';
        } else {
            reason = 'rejected';
        }
    }

    // 6. Phát sự kiện socket cho tất cả các bên tham gia để đồng bộ UI
    call.participants.forEach((participant) => {
        emitCallEnd(participant.userId, {
            callId: callId,
            userIdWhoLeft: currentUserId,
            shouldCloseUI: shouldCloseUI,
            updatedCall: finalCallData,
            reason: reason
        });
    });

    return finalCallData;
}

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

        const updatedCall = await CALL_REPOSITORY.updateOne({
            _id: new ObjectId(callId)
        }, {
            $set: {
                participants: call.participants,
                updatedAt: new Date(),
                status: callStatuses.ACTIVE
            }
        });

        const finalCallData = await CALL_REPOSITORY.findOne({ _id: new ObjectId(callId) });

        // 6. Phát sự kiện socket cho tất cả các bên tham gia để đồng bộ UI
        //TỚI ĐÂY TIẾN HÀNH CẬP NHÂTHJ UI KHI ĐÃ ACCREPT CUỘC GỌI
        //SAU ĐÓ BỔ SUNG EMIT SOCKET Ở FE ĐỂ KHI ĐỐI PHƯƠNG BÂTHJ TẮT VIDEO HAY AUDIO THÌ NGƯỜI CÒN LẠI SẼ UPDATE UI CUIAR HỌ
        call.participants.forEach((participant) => {
            emitAcceptCall(participant.userId, {
                callId: callId,
                updatedCall: finalCallData,
                userIdWhoAccepted: currentUserId,
            });
        });

        return finalCallData;
    } catch (error) {
        throw error
    }
}


export const CALL_SERVICE = {
    onGetTurnCredentials,
    onMakeCall,
    onEndCall,
    onAcceptCall
}