import { INVITATION_SERVICE } from "../service/invitation.service.js";

const onAddContact = async(req, res, next) => {
    try {
        const data = req.body; 
        const result = await INVITATION_SERVICE.onAddContact(data, req.user.id)
        return res.status(201).json({
            data: result,
            message: "Đã gửi lời mời kết bạn thành công"
        })
    } catch (error) {
        next(error)
    }
}

const onGetFriendRequest = async(req, res, next) => {
    try {
        const options = {
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            skip: req.query.skip ? Number(req.query.skip) : undefined,
        }
        const data = await INVITATION_SERVICE.onGetFriendRequest(req.user.id, options);
        res.status(200).json({
            data: data
        })
    } catch (error) {
        next(error)
    }
}

const onGetSentInvitation = async(req, res, next) => {
    try {
        const options = {
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            skip: req.query.skip ? Number(req.query.skip) : undefined,
        }
        const data = await INVITATION_SERVICE.onGetSentInvitation(
           req.user.id,
           options
        );
        res.status(200).json({
            data: data
        })
    } catch (error) {
        next(error)
    }
}

const onGetCountFriendRequest  = async(req, res, next) => {
    try {
        const countData = await INVITATION_SERVICE.onGetCountFriendRequest(req.user.id);
        res.status(200).json({
            data: countData
        })
    } catch (error) {
        next(error)
    }
}

const onGetCountSentInvitation = async(req, res, next) => {
    try {
        const countData = await INVITATION_SERVICE.onGetCountSentInvitation(req.user.id);
        res.status(200).json({
            data: countData
        })
    } catch (error) {
        next(error)
    }
}

const onAccept = async(req, res, next) => {
    try {
        const data = await INVITATION_SERVICE.onAccept(req.body);
        res.status(200).json({
            data: data
        })
    } catch (error) {
        next(error)
    }
}

const onDecline = async(req, res, next) => {
    try {
        const data = await INVITATION_SERVICE.onDecline(req.body);
        res.status(200).json({
            data: data
        })
    } catch (error) {
        next(error)
    }
}

const onCancelSent = async(req, res, next) => {
    try {
        const data = await INVITATION_SERVICE.onCancelSent(req.body);
        res.status(200).json({
            data: data
        })
    } catch (error) {
        next(error)
    }
}

export const INVITATION_CONTROLLER = {
    onAddContact,
    onGetFriendRequest,
    onGetSentInvitation,
    onGetCountFriendRequest,
    onGetCountSentInvitation,
    onAccept,
    onDecline,
    onCancelSent
}