import { Router } from "express";
import { USER_ADMIN_CONTROLLER } from "../../controlles/admin/userAdmin.controller.js";
import { authAdminMiddleware } from "../../middleware/authMiddleware.js";

const userAdminRoutes = Router()


userAdminRoutes.get('/admin/get-data-user', authAdminMiddleware ,USER_ADMIN_CONTROLLER.onGetDataUser)

userAdminRoutes.post('/admin/create-admin', authAdminMiddleware ,USER_ADMIN_CONTROLLER.onCreateAdmin)

userAdminRoutes.put(`/admin/update-admin/:_id`, authAdminMiddleware ,USER_ADMIN_CONTROLLER.onUpdateAdmin)

userAdminRoutes.put('/admin/ban-user/:_id', authAdminMiddleware ,USER_ADMIN_CONTROLLER.onBanUser)

userAdminRoutes.put('/admin/unban-user/:_id', authAdminMiddleware ,USER_ADMIN_CONTROLLER.onUnbanUser)

userAdminRoutes.post('/admin/send-mail-verify/:_id', authAdminMiddleware ,USER_ADMIN_CONTROLLER.onSendMailVerify)


export default userAdminRoutes