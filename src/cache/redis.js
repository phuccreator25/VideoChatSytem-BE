import { redisCache } from "../config/redis"

const redisSet = async ({ key, value, ttl }) => {
    return await redisCache.set(key, value, 'EX', ttl)
}

const redisGet = async (key) => {
    return await redisCache.get(key)
}

const redisDel = async (key) => {
    return await redisCache.del(key)
}

export const REDIS = { redisSet, redisGet, redisDel }
