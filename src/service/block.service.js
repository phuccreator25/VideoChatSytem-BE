import { BLOCK_REPOSITORY } from "../repository/block.repository.js";
import { USER_REPOSITORY } from "../repository/user.repository.js";
import { emitBlockUser, emitUnblockUser } from "../sockets/emitters/block.emitter.js";

const onBlock = async ({ currentUserId, UserBlockedId }) => {
    if (!currentUserId || !UserBlockedId) return;

    const user = await USER_REPOSITORY.findById(UserBlockedId);

    if (!user) throw new Error('User Not Found');

    if (currentUserId === UserBlockedId) throw new Error("You can't block yourself.");

    const blockItem = await BLOCK_REPOSITORY.findByBlock(currentUserId, UserBlockedId);

    if (blockItem && blockItem.status === 'blocked') throw new Error('You have blocked this person.');

    const dataCreated = {
        blockerId: currentUserId,
        blockedId: UserBlockedId,
        status: 'blocked',
        blockedAt: new Date(),
        unblockedAt: null,
        createdAt: new Date(),
    };

    if (blockItem && blockItem.status === 'unblocked') {
        await BLOCK_REPOSITORY.updateOne({ filter: { blockerId: currentUserId, blockedId: UserBlockedId }, data: dataCreated });
    } else {
        await BLOCK_REPOSITORY.createOne(dataCreated);
    }

    emitBlockUser(UserBlockedId, {
        userId: currentUserId,
        isBlockedMe: true,
    });

    emitBlockUser(currentUserId, {
        userId: UserBlockedId,
        isBlockedByMe: true,
    });

    return {
        userId: UserBlockedId,
        isBlockedByMe: true,
    };
};

const onUnblock = async ({ currentUserId, UserBlockedId }) => {
    if (!currentUserId || !UserBlockedId) return;

    const user = await USER_REPOSITORY.findById(UserBlockedId);

    if (!user) throw new Error('User Not Found');

    if (currentUserId === UserBlockedId) throw new Error("You can't unblock yourself.");

    const blockItem = await BLOCK_REPOSITORY.findByBlock(currentUserId, UserBlockedId);

    if (!blockItem) throw new Error('You have not blocked this person.');

    const dataUpdated = {
        blockerId: currentUserId,
        blockedId: UserBlockedId,
        status: 'unblocked',
        unblockedAt: new Date(),
    };

    await BLOCK_REPOSITORY.updateOne({ filter: { blockerId: currentUserId, blockedId: UserBlockedId }, data: dataUpdated });

    emitUnblockUser(UserBlockedId, {
        userId: currentUserId,
        isBlockedMe: false,
    });

    emitUnblockUser(currentUserId, {
        userId: UserBlockedId,
        isBlockedByMe: false,
    });

    return {
        userId: UserBlockedId,
        isBlockedByMe: false,
    };
};

export const BLOCK_SERVICE ={
    onBlock,
    onUnblock
}