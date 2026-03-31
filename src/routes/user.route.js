import { Router } from 'express'
import { USER_CONTROLLER } from '../controlles/user.controller.js'
import { authMiddleware } from '../middleware/authMiddleware.js'

const userRouter = Router()

userRouter.post('/auth/register', USER_CONTROLLER.onRegister)
userRouter.post('/auth/active-account', USER_CONTROLLER.onActivateAccount )
userRouter.post('/auth/login', USER_CONTROLLER.onLogin)
userRouter.post('/auth/refresh-token', USER_CONTROLLER.onRefreshToken)
userRouter.post('/auth/logout', USER_CONTROLLER.onLogOut)
userRouter.post('/auth/forgot-password', USER_CONTROLLER.onForgotPassword)
userRouter.post('/auth/reset-password/:email', USER_CONTROLLER.onResetPassword)

userRouter.get('/users', authMiddleware, USER_CONTROLLER.onGetUsers)

export default userRouter