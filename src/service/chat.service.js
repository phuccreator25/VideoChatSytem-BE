import { onSendMessage, onResendMessage, processSendMessage, markConversationAsRead } from "./chat/message.service.js";
import { onReactEmotion, onUnReactEmotion } from "./chat/reaction.service.js";
import { onForwardMessageSingle, onForwardMessage } from "./chat/forward.service.js";
import { onDeleteMessage, onRevokeMessage, onSearchMessage, onSearchMessageGlobal } from "./chat/messageManage.service.js";
import { onGetShareMedia, onGetShareFiles, onGetShareLinks, onGetLinkPreview, onGetAllAttachedFiles } from "./chat/shareMedia.service.js";

export const CHAT_SERVICE = {
  onSendMessage,
  onResendMessage,
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
  onSearchMessageGlobal,
  onGetAllAttachedFiles
};
