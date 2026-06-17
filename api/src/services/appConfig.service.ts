import { getDb } from "../db/connection.js";
import { getAppConfigCollection } from "../db/collections.js";

export async function getConfig<T>(key: string): Promise<T | null> {
  const db  = await getDb();
  const col = getAppConfigCollection(db);
  const doc = await col.findOne({ _id: key });
  return doc ? (doc.value as T) : null;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  const db  = await getDb();
  const col = getAppConfigCollection(db);
  await col.updateOne(
    { _id: key },
    { $set: { value, updatedAt: new Date() } },
    { upsert: true },
  );
}
