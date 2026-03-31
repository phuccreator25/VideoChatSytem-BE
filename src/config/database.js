import { MongoClient } from "mongodb";
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatApp';

const client = new MongoClient(url);
let db;

export const connectDB = async () => {
  try {
    await client.connect()
    db = client.db()
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