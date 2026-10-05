import { Router } from "express";
import { PROFILE_ADMIN_CONTROLLER } from "../../controlles/admin/profileAdmin.controller.js";
import { authAdminMiddleware } from "../../middleware/authMiddleware.js";

const profileAdminRoutes = Router()

profileAdminRoutes.get('/admin/profile', authAdminMiddleware, PROFILE_ADMIN_CONTROLLER.onGetProfile)
profileAdminRoutes.put('/admin/update-profile', authAdminMiddleware, PROFILE_ADMIN_CONTROLLER.onUpdateProfile)

profileAdminRoutes.post('/admin/upload/presign', authAdminMiddleware,  PROFILE_ADMIN_CONTROLLER.onUploadPresign)

export default profileAdminRoutes