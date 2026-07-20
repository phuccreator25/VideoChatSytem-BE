import { onSendMessage, processSendMessage, markConversationAsRead } from "./chat/message.service.js";
import { onReactEmotion, onUnReactEmotion } from "./chat/reaction.service.js";
import { onForwardMessageSingle, onForwardMessage } from "./chat/forward.service.js";
import { onDeleteMessage, onRevokeMessage, onSearchMessage } from "./chat/messageManage.service.js";
import { onGetShareMedia, onGetShareFiles, onGetShareLinks, onGetLinkPreview } from "./chat/shareMedia.service.js";

export const CHAT_SERVICE = {
  onSendMessage,
  processSendMessage,
  markConversationAsRead,
  onReactEmotion,
  onUnReactEmotion,
  onForwardMessageSingle,
  onForwardMessage,
  onDeleteMessage,
  onRevokeMessage,
  onSearchMessage,
  onGetShareMedia,
  onGetShareFiles,
  onGetShareLinks,
  onGetLinkPreview,
};
