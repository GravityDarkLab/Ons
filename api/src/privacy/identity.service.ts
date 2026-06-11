import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { getIdentitiesCollection } from "../db/collections.js";
import { encrypt, decrypt } from "./encryption.js";
import { hashInstagram } from "./hash.js";

export async function storeIdentity(
  applicantId: ObjectId,
  alias: string,
  instagramHandle: string
): Promise<void> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);

  const { encrypted, iv, tag } = encrypt(instagramHandle);

  await identities.insertOne({
    _id: new ObjectId(),
    applicantId,
    alias,
    encryptedInstagram: encrypted,
    encryptionIv: iv,
    encryptionTag: tag,
    instagramHash: hashInstagram(instagramHandle),
    createdAt: new Date(),
  });
}

export async function checkInstagramExists(handle: string): Promise<boolean> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);
  const hash = hashInstagram(handle);
  const doc = await identities.findOne({ instagramHash: hash }, { projection: { _id: 1 } });
  return doc !== null;
}

export async function resolveIdentity(alias: string): Promise<string | null> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);

  const doc = await identities.findOne({ alias });
  if (!doc) return null;

  return decrypt(doc.encryptedInstagram, doc.encryptionIv, doc.encryptionTag);
}

export async function resolveIdentityById(
  applicantId: ObjectId
): Promise<string | null> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);

  const doc = await identities.findOne({ applicantId });
  if (!doc) return null;

  return decrypt(doc.encryptedInstagram, doc.encryptionIv, doc.encryptionTag);
}
