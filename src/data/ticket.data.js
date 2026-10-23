export const reportTargetTypes = {
  MESSAGE: 'message',
  ACCOUNT: 'account',
};

export const reportMessageReasons = {
  SPAM: 'spam',
  HARASSMENT: 'harassment',
  FRAUD: 'fraud',
  HATE_SPEECH: 'hate_speech',
  INAPPROPRIATE_MEDIA: 'inappropriate_media',
  OTHER: 'other',
};

export const reportAccountReasons = {
  FAKE_IDENTITY: 'fake_identity',
  SCAM_ACCOUNT: 'scam_account',
  BOT_SPAM: 'bot_spam',
  HARASSMENT_BEHAVIOR: 'harassment_behavior',
  OTHER: 'other',
};

export const allReportReasons = [
  ...Object.values(reportMessageReasons),
  ...Object.values(reportAccountReasons),
];

export const reportStatuses = {
  PENDING: 'pending',         // Mới tạo, chờ tiếp nhận
  IN_PROGRESS: 'in_progress', // Admin đã nhận việc
  RESOLVED: 'resolved',       // Đã xử lý (chấp thuận tố cáo)
  REJECTED: 'rejected',       // Bác bỏ (không đủ căn cứ)
  CANCELLED: 'cancelled',     // Client tự rút lại khi còn pending
};

export const reportResolutionActions = {
  NONE: 'none',
  WARNED_USER: 'warned_user',         // Cảnh cáo người vi phạm
  BANNED_USER: 'banned_user',         // Khóa tài khoản
  DELETED_MESSAGE: 'deleted_message', // Gỡ/thu hồi tin nhắn vi phạm
  DISMISSED: 'dismissed',             // Bác bỏ không xử lý
};

export const ACCOUNT_REPORT_COOLDOWN_HOURS = 48;