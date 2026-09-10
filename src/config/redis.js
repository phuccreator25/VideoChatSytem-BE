import env from "../config/env.js";
import IORedis from "ioredis";

const redisConfig = {
  host: env.REDIS_HOST || "127.0.0.1",
  port: Number(env.REDIS_PORT) || 6379,
  //Bổ sung password cho production
  maxRetriesPerRequest: null,
}

export const redisCache = new IORedis(
  { ...redisConfig, maxRetriesPerRequest: 3 }
)

export const redisQueueConnection = new IORedis(redisConfig);