import { CALL_ADMIN_SERVICE } from "../../service/admin/callAdmin.service.js";

const onGetData = async(req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    
    const { status, type, endReason, startDate, endDate, search } = req.query;
    const filters = { status, type, endReason, startDate, endDate, search }

    const dataCalls = await CALL_ADMIN_SERVICE.onGetData({ filters, page, limit })

    return res.status(200).json({
        data: dataCalls,
    })
  } catch (error) {
    next(error)
  }
}

export const CALL_ADMIN_CONTROLLER = {
    onGetData
}