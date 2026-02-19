import admin from "firebase-admin";
import { env } from "./env";

const credentialJson = Buffer.from(env.FIREBASE_CREDENTIAL, "base64").toString(
  "utf-8"
);

// Firebase Admin SDK는 같은 앱을 두 번 초기화하면 에러가 발생하므로 중복 초기화를 방지한다.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(credentialJson)),
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });
}

/** Firebase Storage 버킷 인스턴스. */
export const firebaseStorage = admin.storage().bucket();
