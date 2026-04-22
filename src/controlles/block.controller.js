import { BLOCK_SERVICE } from "../service/block.service.js"

const onBlock = async(req, res, next) => {
    try {
        const currentUserId = req.user.id
        const UserBlockedId = req.body.userId

        const block = await BLOCK_SERVICE.onBlock({currentUserId, UserBlockedId})

        return res.status(201).json({
            data: block
        })
    } catch (error) {
        next(error)
    }
}

const onUnblock = async(req, res, next) => {
    try {
        const currentUserId = req.user.id
        const UserBlockedId = req.body.userId

        const unBlock = await BLOCK_SERVICE.onUnblock({currentUserId, UserBlockedId})

        return res.status(201).json({
            data: unBlock
        })
    } catch (error) {
        next(error)
    }
}

export const BLOCK_CONTROLLER = {
    onBlock, onUnblock
}