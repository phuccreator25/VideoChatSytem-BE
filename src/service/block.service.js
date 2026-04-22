import { BLOCK_REPOSITORY } from "../repository/block.repository.js";
import { USER_REPOSITORY } from "../repository/user.repository.js";

const onBlock = async({currentUserId, UserBlockedId}) => {
    if(!currentUserId || !UserBlockedId) return;

    const user = USER_REPOSITORY.findById(UserBlockedId)

    if(!user) throw new Error ('User Not Found')

    const blockItem = await BLOCK_REPOSITORY.findByBlock(currentUserId,UserBlockedId)

    if(blockItem && blockItem.status === 'blocked') throw new Error ('You have blocked this person.')

    const dataCreated = {
        blockerId: currentUserId,
        blockedId: UserBlockedId,
        status: 'blocked',
        blockedAt: new Date(),
        unblockedAt: null,
        createdAt: new Date()
    }

    if(blockItem && blockItem.status === 'unblocked') {
        const block = await BLOCK_REPOSITORY.updateOne({ filter: { blockerId: currentUserId, blockedId: UserBlockedId }, data: dataCreated })
        return block
    }

    const block = await BLOCK_REPOSITORY.createOne(dataCreated)

    return block
}

const onUnblock = async({currentUserId, UserBlockedId}) => {
    if(!currentUserId || !UserBlockedId) return;

    const user = USER_REPOSITORY.findById(UserBlockedId)

    if(!user) throw new Error ('User Not Found')

    const blockItem = await BLOCK_REPOSITORY.findByBlock(currentUserId,UserBlockedId)

    if(!blockItem) throw new Error ('You have not blocked this person.')

    const dataCreated = {
        blockerId: currentUserId,
        blockedId: UserBlockedId,
        status: 'unblocked',
        blockedAt: new Date(),
        unblockedAt: null,
        createdAt: new Date()
    }

    const unBlock = await BLOCK_REPOSITORY.updateOne({ filter: { blockerId: currentUserId, blockedId: UserBlockedId }, data: dataCreated })

    return unBlock
}

export const BLOCK_SERVICE ={
    onBlock,
    onUnblock
}