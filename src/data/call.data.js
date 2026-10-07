export const callTypes = {
    VOICE: "voice",
    VIDEO: "video",
};

export const callStatuses = {
  RINGING: "ringing",
  ACTIVE: "active",
  COMPLETED: "completed",
  REJECTED: "rejected",
  MISSED: "missed",
  CANCELLED: "cancelled",
};

export const callEndReasons = {
  NORMAL: "normal",
  NETWORK_LOST: "network_lost",
  TIMEOUT: "timeout",
};

export const participantRoles = {
    CALLER: "caller",
    CALLEE: "callee",
};

export const participantStatuses = {
    PENDING: "pending",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    MISSED: "missed",
};

export const vectorStatus = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed'
}