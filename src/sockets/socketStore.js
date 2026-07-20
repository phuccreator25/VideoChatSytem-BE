import { callStatuses } from "../data/call.data.js";
import { CALL_REPOSITORY } from "../repository/call.repository.js";
import { CALL_SERVICE } from "../service/call.service.js";
import { emitCallOffer, emitCallRinging } from "./emitters/call.emiter.js";
import { ObjectId } from "mongodb";

const userSocketMap = {};
const pendingOfferMap = new Map();
const callTimerMap = new Map();
const sharingScreenMap = new Map();

export function setSharingScreen(callId, userId) {
  if (!callId || !userId) return;
  sharingScreenMap.set(String(callId), String(userId));
}

export function getSharingScreen(callId) {
  if (!callId) return null;
  return sharingScreenMap.get(String(callId));
}

export function removeSharingScreen(callId) {
  if (!callId) return;
  sharingScreenMap.delete(String(callId));
}

export function setCallTimer(callId, timer) {
  if (!callId) return;
  if (callTimerMap.has(String(callId))) {
    clearTimeout(callTimerMap.get(String(callId)));
  }
  callTimerMap.set(String(callId), timer);
}

export function clearCallTimer(callId) {
  if (!callId) return;
  if (callTimerMap.has(String(callId))) {
    clearTimeout(callTimerMap.get(String(callId)));
    callTimerMap.delete(String(callId));
  }
}

export function addUserSocket(userId, sessionId, socket) {
  if (!userSocketMap[userId]) {
    userSocketMap[userId] = {};
  }

  if (!userSocketMap[userId][sessionId]) {
    userSocketMap[userId][sessionId] = {};
  }

  userSocketMap[userId][sessionId][socket.id] = socket;

  // 🔥 TỰ ĐỘNG PHÁT LẠI CUỘC GỌI ĐANG CHỜ (PENDING OFFER) KHI USER VỪA ONLINE LẠI
  const pendingOffer = pendingOfferMap.get(String(userId));
  if (pendingOffer) {
    pendingOfferMap.delete(String(userId));
    CALL_REPOSITORY.findOne({ _id: new ObjectId(pendingOffer.callId) }).then((call) => {
      if (call && call.status === callStatuses.RINGING) {
        console.log(`🔥 User ${userId} vừa online! Bù lại gói call:offer đang chờ.`);
        clearCallTimer(pendingOffer.callId);

        emitCallOffer(userId, pendingOffer);
        emitCallRinging(pendingOffer.callerId, { callId: pendingOffer.callId });

        setCallTimer(pendingOffer.callId, setTimeout(async () => {
          try {
            const currentCall = await CALL_REPOSITORY.findOne({ _id: new ObjectId(pendingOffer.callId) });
            if (currentCall && currentCall.status === callStatuses.RINGING) {
              console.log(`⏱️ Cuộc gọi ${pendingOffer.callId} hết 20s không nhấc máy (No Answer) -> Tự động hủy.`);
              await CALL_SERVICE.onEndCall({
                callId: pendingOffer.callId,
                currentUserId: pendingOffer.callerId,
              });
            }
          } catch (err) {
            console.error("Lỗi khi xử lý timeout cuộc gọi không phản hồi:", err);
          }
        }, 20000));
      }
    }).catch(err => console.error("Error checking pending offer call status:", err));
  }
}

/**
 * Quản lý cuộc gọi đang chờ Callee (Pending Offers trong RAM)
 */
export function setPendingOffer(calleeId, offerPayload) {
  if (!calleeId || !offerPayload) return;
  pendingOfferMap.set(String(calleeId), offerPayload);
}

export function getPendingOffer(calleeId) {
  if (!calleeId) return null;
  return pendingOfferMap.get(String(calleeId));
}

export function removePendingOffer(calleeId) {
  if (!calleeId) return;
  pendingOfferMap.delete(String(calleeId));
}

export function removeUserSocket(userId, sessionId, socketId = null) {
  if (!userSocketMap[userId]) return;

  const sessionSockets = userSocketMap[userId][sessionId];
  if (!sessionSockets) return;

  if (socketId) {
    delete sessionSockets[socketId];
  } else {
    delete userSocketMap[userId][sessionId];
  }

  if (Object.keys(sessionSockets).length === 0) {
    delete userSocketMap[userId][sessionId];
  }

  if (Object.keys(userSocketMap[userId]).length === 0) {
    delete userSocketMap[userId];
  }
}

export function disconnectUserSession(userId, sessionId) {
  const userSessions = userSocketMap[userId];
  if (!userSessions) return;

  const sessionSockets = userSessions[sessionId];
  if (!sessionSockets) return;

  const sockets = Object.values(sessionSockets);

  sockets.forEach((socket) => {
    if (socket?.connected) {
      socket.disconnect(true);
    }
  });
}

export function isUserOnline(userId) {
  if (!userId) return false;

  if (!userSocketMap[userId]) return false;

  return Object.values(userSocketMap[userId]).some(
    (sessionSockets) => Object.keys(sessionSockets).length > 0
  );
}

export function emitToUser(userId, eventName, payload) {
  const sessions = userSocketMap[userId];
  if (!sessions) return;

  Object.values(sessions).forEach((sessionSockets) => {
    Object.values(sessionSockets).forEach((socket) => {
      if (socket?.connected) {
        socket.emit(eventName, payload);
      }
    });
  });
}

// ==========================================
// ACTIVE CALLS IN-MEMORY CACHE (RAM)
// ==========================================
const activeCallMap = new Map();

/**
 * Thêm một hoặc nhiều thành viên vào phiên gọi của conversationId
 */
export function addCallParticipants(conversationId, userIds) {
  if (!conversationId || !userIds) return;

  if (!activeCallMap.has(String(conversationId))) {
    activeCallMap.set(String(conversationId), new Set());
  }

  const participantSet = activeCallMap.get(String(conversationId));
  const idArray = Array.isArray(userIds) ? userIds : [userIds];

  idArray.forEach((id) => {
    if (id) participantSet.add(String(id));
  });
}

/**
 * Lấy danh sách các đối tác trong cuộc gọi (loại trừ currentUserId)
 */
export function getCallOtherParticipants(conversationId, currentUserId) {
  if (!conversationId) return [];

  const participantSet = activeCallMap.get(String(conversationId));
  if (!participantSet) return [];

  return Array.from(participantSet).filter(
    (id) => String(id) !== String(currentUserId)
  );
}

/**
 * Xóa một thành viên khỏi phiên gọi
 */
export function removeCallParticipant(conversationId, userId) {
  if (!conversationId || !userId) return;

  const participantSet = activeCallMap.get(String(conversationId));
  if (participantSet) {
    participantSet.delete(String(userId));
    if (participantSet.size === 0) {
      activeCallMap.delete(String(conversationId));
    }
  }
}

/**
 * Dọn dẹp hoàn toàn phiên gọi của conversationId
 */
export function endCallSession(conversationId) {
  if (!conversationId) return;
  activeCallMap.delete(String(conversationId));
}
