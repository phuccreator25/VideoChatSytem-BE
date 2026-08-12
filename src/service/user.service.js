import {
  onRegister,
  onActiveAccount,
  onLogin,
  onLogOut,
  onForgotPassword,
  onResetPassword,
  onRefreshToken,
  onGetListSession,
  onBanSession,
  onBanAllOtherSessions,
} from "./user/userAuth.service.js";

import {
  onGetUserById,
  onUpdateUser,
  onSearchUser,
  onUpdateStatus,
} from "./user/userProfile.service.js";

import {
  onHandleUserConnected,
  onHandleUserDisconnected,
} from "./user/userPresence.service.js";

export const USER_SERVICE = {
  onRegister,
  onActiveAccount,
  onLogin,
  onLogOut,
  onForgotPassword,
  onResetPassword,
  onGetUserById,
  onRefreshToken,
  onUpdateUser,
  onSearchUser,
  onUpdateStatus,
  onHandleUserConnected,
  onHandleUserDisconnected,
  onGetListSession,
  onBanSession,
  onBanAllOtherSessions,
};
