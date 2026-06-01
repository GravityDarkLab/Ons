import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { getIdentitiesCollection } from "../db/collections.js";
import { encrypt, decrypt } from "./encryption.js";

/**
 * Encrypts the Instagram handle and persists the identity document.
 * Must be called after the applicant document is created.
 */
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
    createdAt: new Date(),
  });
}

/**
 * Decrypts and returns the Instagram handle for an applicant identified by alias.
 * Returns null if no identity record is found.
 */
export async function resolveIdentity(
  alias: string
): Promise<string | null> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);

  const doc = await identities.findOne({ alias });
  if (!doc) return null;

  return decrypt(doc.encryptedInstagram, doc.encryptionIv, doc.encryptionTag);
}

/**
 * Decrypts and returns the Instagram handle for an applicant identified by applicantId.
 * Returns null if no identity record is found.
 */
export async function resolveIdentityById(
  applicantId: ObjectId
): Promise<string | null> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);

  const doc = await identities.findOne({ applicantId });
  if (!doc) return null;

  return decrypt(doc.encryptedInstagram, doc.encryptionIv, doc.encryptionTag);
}
