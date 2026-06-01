import { MongoClient, Db } from "mongodb";
import { env } from "../config/env.js";

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Gets the MongoDB database instance. Initializes the connection if not already connected.
 * 
 * This presents a simple singleton pattern for managing the database connection.
 * The first call to getDb() will establish the connection, and subsequent calls will reuse the existing connection.
 * 
 * @returns Promise<Db> The MongoDB database instance
 * @throws Error if connection fails
 */
export async function getDb(): Promise<Db> {
  if (db) return db;

  if (!client) {
    client = new MongoClient(env.mongodbUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    console.log("[DB] Connected to MongoDB");
  }

  db = client.db(env.mongodbDbName);
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.info("[DB] MongoDB connection closed");
  } else {
    console.warn("[DB] closeDb called but no client exists");
  }
}
