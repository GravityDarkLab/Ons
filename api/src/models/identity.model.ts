import { ObjectId } from "mongodb";

export interface IdentityDoc {
  _id: ObjectId;
  applicantId: ObjectId;
  alias: string;
  encryptedInstagram: string;
  encryptionIv: string;
  encryptionTag: string;
  createdAt: Date;
}
