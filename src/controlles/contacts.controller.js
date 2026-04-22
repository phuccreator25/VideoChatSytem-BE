import { CONTACT_SERVICE } from "../service/contacts.service.js"

const onGetData = async(req, res, next) => {
    try {
        const data = await CONTACT_SERVICE.onGetData(req.user.id)
        res.status(200).json({
            data: data
        })
    } catch (error) {
        next(error)
    }
}

const onUpdateContact = async(req, res, next) => {
    try {
        const data = await CONTACT_SERVICE.onUpdateContact({
            currentUserId: req.user.id,
            payload: req.body
        })

    return res.status(201).json({
        data: data
    })
    } catch (error) {
        next(error)
    }
}

const onRemoveFriend = async(req, res, next) => {
    try {
        const ownerId = req.user.id
        const friendId = req.params.idFriend

        const dataDeleted = await CONTACT_SERVICE.onRemoveContact({ownerId, friendId})

        return res.status(201).json({ success: true })
    } catch (error) {
        next(error)
    }
}

export const CONTACT_CONTROLLER = {
    onGetData, onUpdateContact, onRemoveFriend
}