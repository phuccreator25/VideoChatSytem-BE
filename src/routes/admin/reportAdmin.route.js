import { Router } from "express";
import { authAdminMiddleware } from "../../middleware/authMiddleware.js";
import { REPORT_ADMIN_CONTROLER } from "../../controlles/admin/reportAdmin.controller.js";

const reportAdminRoutes = Router()

reportAdminRoutes.get('/admin/reports', authAdminMiddleware, REPORT_ADMIN_CONTROLER.onGetData)
reportAdminRoutes.put('/admin/reports/:id/progress', authAdminMiddleware, REPORT_ADMIN_CONTROLER.onProgress)
reportAdminRoutes.put('/admin/reports/:id/resolve', authAdminMiddleware, REPORT_ADMIN_CONTROLER.onResolve)
reportAdminRoutes.put('/admin/reports/:id/release', authAdminMiddleware, REPORT_ADMIN_CONTROLER.onRelease)

export default reportAdminRoutes