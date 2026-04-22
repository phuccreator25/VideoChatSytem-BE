import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { BLOCK_CONTROLLER } from "../controlles/block.controller.js";

const blockRouter = Router()

blockRouter.post('/blocks', authMiddleware, BLOCK_CONTROLLER.onBlock)
blockRouter.put('/blocks/unBlock', authMiddleware, BLOCK_CONTROLLER.onUnblock)

export default blockRouter