import {
  onRegister,
  onActiveAccount,
  onLogin,
  onLogOut,
  onForgotPassword,
  onResetPassword,
  onRefreshToken,
} from "./user/userAuth.service.js";

import {
  onGetUsers,
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
  onGetUsers,
  onRefreshToken,
  onUpdateUser,
  onSearchUser,
  onUpdateStatus,
  onHandleUserConnected,
  onHandleUserDisconnected,
};
