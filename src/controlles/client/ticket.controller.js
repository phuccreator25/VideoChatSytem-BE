import { TICKET_SERVICE } from "../../service/client/ticket.service.js";

const createOne = async (req, res, next) => {
    try {
        const payload = req.body;
        payload.reporterId = req.user.id;
        const result = await TICKET_SERVICE.createOne(payload);
        return res.status(201).json({
            data: result,
        })
    } catch (error) {
      next(error)
    }
};

const onGetData = async(req, res, next) => {
  try {
      const currentUserId = req.user.id;
      const { search, targetType, status, page, limit } = req.query;

      const filters = { 
        currentUserId,
        search,
        targetType,
        status,
      }

      const data = await TICKET_SERVICE.onGetData({filters, page, limit})

      return res.status(200).json({
        data,
      })
  } catch (error) {
    next(error)
  }
}

const onCancel = async(req, res, next) => {
  try {
      const id = req.params.id;
      const currentUserId = req.user.id;
      const result = await TICKET_SERVICE.onCancel(id, currentUserId);
      return res.status(200).json({
        data: result,
      })
  } catch (error) {
    next(error)
  }
}

export const TICKET_CONTROLLER = {
  createOne,
  onGetData,
  onCancel
};