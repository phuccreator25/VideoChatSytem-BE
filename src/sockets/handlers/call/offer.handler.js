import { ObjectId } from "mongodb";
import { callStatuses } from "../../../data/call.data.js";
import { CALL_REPOSITORY } from "../../../repository/call.repository.js";
import { CONTACTS_REPOSITORY } from "../../../repository/contacts.repository.js";
import { CALL_SERVICE } from "../../../service/call.service.js";
import { emitCallInitiated, emitCallOffer, emitCallOffline, emitCallRinging } from "../../emitters/call.emiter.js";
import { addCallParticipants, isUserOnline, removePendingOffer, setPendingOffer, setCallTimer } from "../../socketStore.js";

export const handleCallOffer = async (io, socket, data) => {
    try {
        const { conversationId, callerId, calleeId, offer, type } = data;
        console.log('Type socker: ', type);


        if (!callerId || !calleeId || !offer || !conversationId || !type) {
            socket.emit("call:offer:error", {
                message: "Missing callerId or calleeId or offer or conversationId or type",
            });
            console.log("call:offer:error: missing data");

            return;
        }

        const result = await CALL_SERVICE.onMakeCall({ data });

        addCallParticipants(conversationId, [callerId, calleeId]); // thêm user vào room call

        const callerData = await CONTACTS_REPOSITORY.findContactDetails(calleeId, callerId);

        const callerInfo = callerData ? {
            userId: callerData.userId,
            avatar: callerData.avatar,
            fullname: callerData.fullname,
            nickname: callerData.nickname,
            isOnline: "online",
        } : null;

        const isOnlineCallee = isUserOnline(calleeId);

        const offerPayload = {
            offer,
            callerId,
            calleeId,
            type,
            callId: result.insertedId.toString(),
            conversationId,
            callerInfo
        };

        if (!isOnlineCallee) {
            emitCallOffline(callerId, {
                callId: result.insertedId.toString(),
            });

            setPendingOffer(calleeId, offerPayload); // Lưu lại offer

            setCallTimer(result.insertedId.toString(), setTimeout(async () => { // 10s khong online -> hủy
                try {
                    removePendingOffer(calleeId);

                    const call = await CALL_REPOSITORY.findOne({ _id: new ObjectId(result.insertedId.toString()) });

                    if (call && call.status === callStatuses.RINGING) {
                        console.log(`Cuộc gọi ${result.insertedId.toString()} hết 10s timeout (Callee Offline) -> Tự động hủy.`);

                        await CALL_SERVICE.onEndCall({
                            callId: result.insertedId.toString(),
                            currentUserId: callerId,
                            reason: 'timeout',
                        });
                    }
                } catch (err) {
                    console.error("Lỗi khi xử lý timeout cuộc gọi offline:", err);
                }
            }, 10000));

        } else {
            emitCallOffer(calleeId, offerPayload);

            emitCallRinging(callerId, {
                callId: result.insertedId.toString(),
            });

            setCallTimer(result.insertedId.toString(), setTimeout(async () => { // 20s khong nhac may -> huy
                try {
                    const call = await CALL_REPOSITORY.findOne({ _id: new ObjectId(result.insertedId.toString()) });

                    if (call && call.status === callStatuses.RINGING) {
                        console.log(`Cuộc gọi ${result.insertedId.toString()} hết 20s không nhấc máy (No Answer) -> Tự động hủy.`);

                        await CALL_SERVICE.onEndCall({
                            callId: result.insertedId.toString(),
                            currentUserId: callerId,
                            reason: 'missed',
                        });
                    }
                } catch (err) {
                    console.error("Lỗi khi xử lý timeout cuộc gọi không phản hồi:", err);
                }
            }, 20000));
        }

        emitCallInitiated(callerId, {
            callId: result.insertedId.toString(),
        });

    } catch (error) {
        console.error("call:offer error:", error);

        socket.emit("call:offer:error", {
            message: error.message || "Make call failed",
        });
    }
};
