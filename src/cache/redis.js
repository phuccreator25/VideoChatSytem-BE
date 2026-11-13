import { redisCache } from "../config/redis.js"

const redisSet = async ({ key, value, ttl }) => {
    return await redisCache.set(key, value, 'EX', ttl)
}

const redisGet = async (key) => {
    return await redisCache.get(key)
}

const redisDel = async (key) => {
    return await redisCache.del(key)
}

const redisHSet = async ({ key, field, value, ttl }) => {
  await redisCache.hset(key, field, value);
  if (ttl) {
    await redisCache.expire(key, ttl);
  }
};

const redisHGet = async (key, field) => {
  return await redisCache.hget(key, field);
};

const redisHDel = async (key, field) => {
  return await redisCache.hdel(key, field);
};

export const REDIS = { redisSet, redisGet, redisDel, redisHSet, redisHGet, redisHDel }
