import { Router } from 'express'
import { USER_CONTROLLER } from '../controlles/user.controller.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { upload } from '../middleware/upload.middleware.js'

const userRouter = Router()

userRouter.post('/auth/register', USER_CONTROLLER.onRegister)
userRouter.post('/auth/active-account', USER_CONTROLLER.onActivateAccount )
userRouter.post('/auth/login', USER_CONTROLLER.onLogin)
userRouter.post('/auth/refresh-token', USER_CONTROLLER.onRefreshToken)
userRouter.post('/auth/logout', USER_CONTROLLER.onLogOut)
userRouter.post('/auth/forgot-password', USER_CONTROLLER.onForgotPassword)
userRouter.post('/auth/reset-password/:token', USER_CONTROLLER.onResetPassword)

userRouter.get('/users', authMiddleware, USER_CONTROLLER.onGetUsers)
userRouter.put('/users', authMiddleware, USER_CONTROLLER.onUpdate)
userRouter.put('/users/avatar', authMiddleware, upload.single('file'), USER_CONTROLLER.onUpdateAvatar)

userRouter.get(`/users/search/:searchValue`, authMiddleware, USER_CONTROLLER.onSearchUser)
export default userRouter