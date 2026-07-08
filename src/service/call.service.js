import crypto from 'crypto';
import env from '../config/env.js';
import { CALL_REPOSITORY } from '../repository/call.repository.js';
import { callStatuses, callTypes, participantRoles, participantStatuses } from '../data/call.data.js';
import { status } from '../data/user.data.js';
import { ObjectId } from 'mongodb';
import { emitAcceptCall, emitCallEnd } from '../sockets/emitters/call.emiter.js';

const onGetTurnCredentials = () => {
    // 1. Lấy cấu hình từ file .env hoặc fallback về local nếu chưa khai báo
    const authSecret = env.STATIC_AUTH_SECRET;
    const stunUrl = env.STUN_SERVICE;
    const turnUrl = env.TURN_SERVICE;

    // 2. Thiết lập thời gian hết hạn cho Token (24 giờ)
    const ttlInSeconds = 24 * 3600;
    const unixTimeStamp = Math.floor(Date.now() / 1000) + ttlInSeconds;

    // 3. Username định dạng chuẩn của Coturn
    const username = `${unixTimeStamp}:debugdepot_user`;

    // 4. Tạo password bằng cách hash username với mã Secret Key bằng HMAC-SHA1
    const password = crypto
        .createHmac('sha1', authSecret)
        .update(username)
        .digest('base64');

    // 5. TRẢ VỀ ĐÚNG ĐỊNH DẠNG MẢNG ICE SERVERS MÀ CONTROLLER CẦN
    return {
        success: true,
        iceServers: [
            // Luồng ưu tiên 1: STUN phục vụ kết nối trực tiếp P2P
            {
                urls: stunUrl
            },
            // Luồng dự phòng 2: TURN đi kèm tài khoản động vừa tạo để vượt NAT
            {
                urls: turnUrl,
                username: username,
                credential: password
            }
        ]
    };
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
    const call = await CALL_REPOSITORY.findOne({
        _id: new ObjectId(callId)
    });

    if (!call) { throw new Error("Call not found") }

    if (call.status !== callStatuses.RINGING && call.status !== callStatuses.ACTIVE) {
        throw new Error("Call is not active or already ended")
    }

    // 1. Tìm participant hiện tại thực hiện hành động cúp máy/từ chối
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

    // 6. Phát sự kiện socket cho tất cả các bên tham gia để đồng bộ UI
    call.participants.forEach((participant) => {
        emitCallEnd(participant.userId, {
            callId: callId,
            userIdWhoLeft: currentUserId,
            shouldCloseUI: shouldCloseUI,
            updatedCall: finalCallData
        });
    });

    return updatedCall;
}

const onAcceptCall = async ({ callId, currentUserId }) => {
    try {
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
        call.participants.forEach((participant) => {
            emitAcceptCall(participant.userId, {
                callId: callId,
                updatedCall: finalCallData,
                userIdWhoAccepted: currentUserId,
            });
        });

        return updatedCall;
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