import { Router } from "express";
import { ADMIN_AUTH_CONTROLLER } from "../../controlles/admin/adminAuth.controller.js";

const adminAuthRoutes = Router()

adminAuthRoutes.post('/admin/login', ADMIN_AUTH_CONTROLLER.onLogin)


export default adminAuthRoutes
