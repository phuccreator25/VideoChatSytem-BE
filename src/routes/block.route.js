import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { BLOCK_CONTROLLER } from "../controlles/block.controller.js";

const blockRouter = Router()

blockRouter.post('/blocks', authMiddleware, BLOCK_CONTROLLER.onBlock)
blockRouter.put('/blocks/unBlock', authMiddleware, BLOCK_CONTROLLER.onUnblock)
blockRouter.get('/blocks/list-block-user', authMiddleware, BLOCK_CONTROLLER.onGetListBlockUser)

export default blockRouter