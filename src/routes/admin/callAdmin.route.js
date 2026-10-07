import { Router } from "express";
import { authAdminMiddleware } from "../../middleware/authMiddleware.js";
import { CALL_ADMIN_CONTROLLER } from "../../controlles/admin/callAdmin.controller.js";

const callAdminRoutes = Router()

callAdminRoutes.get('/admin/calls', authAdminMiddleware, CALL_ADMIN_CONTROLLER.onGetData)

export default callAdminRoutes