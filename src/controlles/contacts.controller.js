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

export const CONTACT_CONTROLLER = {
    onGetData
}