import { MongoClient } from "mongodb";
import env from "./env.js";
import dns from "node:dns/promises";

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1"]);
}

const url = env.MONGODB_URI

const client = new MongoClient(url);
let db;

export const connectDB = async () => {
  try {
    await client.connect()
    db = client.db(env.DATABASE_NAME)
    console.log('Connect Database Success')
  } catch (error) {
    console.error('Connect Database Fail:', error)
    throw error
  }
}

export const GET_DB = () => {
  if (!db) {
    throw new Error('DB DISCONNECT')
  }
  return db
}

export { client } 