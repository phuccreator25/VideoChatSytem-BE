import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import { TICKET_CONTROLLER } from "../../controlles/client/ticket.controller.js";

const ticketRoutes = Router();

ticketRoutes.post('/tickets/create', authMiddleware, TICKET_CONTROLLER.createOne)
ticketRoutes.get('/tickets/get-data', authMiddleware, TICKET_CONTROLLER.onGetData)
ticketRoutes.delete(`/tickets/:id/cancel`, authMiddleware, TICKET_CONTROLLER.onCancel)

export default ticketRoutes