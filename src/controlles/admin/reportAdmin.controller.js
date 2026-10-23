import { REPORT_ADMIN_SERVICE } from "../../service/admin/reportAdmin.service.js";

const onGetData = async (req, res, next) => {
  try {
    const { targetType, status, reason, search } = req.query;
    
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    
    const filters = {
      targetType,
      status,
      reason,
      search,
    };
    
    const result = await REPORT_ADMIN_SERVICE.onGetData(filters, page, limit);
    return res.status(200).json({
      data: result.reports,
      kpi: result.kpi
    })
} catch (error) {
    next(error);
  }
};

const onProgress = async(req, res, next) => {
  try {
    const id = req.params.id
    const currentAdminId = req.admin.id
    await REPORT_ADMIN_SERVICE.onProgress(id, currentAdminId)
    return res.status(200).json({
      message: "Progress report successfully"
    })
  } catch (error) {
    next(error)
  }
}

const onResolve = async(req, res, next) => {
  try {
    const ticketId = req.params.id
    const currentAdminId = req.admin.id
    const {resolutionActions, status, feedbackToReporter, adminNotes, unBannedAt} = req.body

    await REPORT_ADMIN_SERVICE.onResolveTicket({
        ticketId,
        currentAdminId,
        resolutionActions,
        status,
        feedbackToReporter,
        adminNotes,
        unBannedAt,
    })

    return res.status(200).json({
      message: "Resolve report successfully"
    })
  } catch (error) {
    next(error)
  }
}

const onRelease = async(req, res, next) => {
  try {
    const _id = req.params.id
    const currentAdminId = req.admin.id
    
    await REPORT_ADMIN_SERVICE.onReleaseTicket({_id, currentAdminId})
    
    return res.status(200).json({
      message: "Release report successfully"
    })
  } catch (error) {
    next(error)
  }
}

export const REPORT_ADMIN_CONTROLER = {
    onGetData,
    onProgress,
    onResolve,
    onRelease
}