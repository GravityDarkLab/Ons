import { ObjectId } from "mongodb";

export interface IdentityDoc {
  _id: ObjectId;
  applicantId: ObjectId;
  alias: string;
  encryptedInstagram: string;
  encryptionIv: string;
  encryptionTag: string;
  /** HMAC-SHA256 of normalized handle — enables O(1) duplicate detection without decryption */
  instagramHash: string;
  createdAt: Date;
}
