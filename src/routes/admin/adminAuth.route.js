import { Router } from "express";
import { ADMIN_AUTH_CONTROLLER } from "../../controlles/admin/adminAuth.controller.js";

const adminAuthRoutes = Router()

adminAuthRoutes.post('/admin/login', ADMIN_AUTH_CONTROLLER.onLogin)
adminAuthRoutes.post("/admin/refresh-token", ADMIN_AUTH_CONTROLLER.onRefreshToken)
adminAuthRoutes.post("/admin/logout", ADMIN_AUTH_CONTROLLER.onLogOut)


export default adminAuthRoutes
