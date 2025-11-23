import admin from "firebase-admin";
import { env } from "./env";

// Firebase Admin SDK 사용 함.

const credentialJson = Buffer.from(env.FIREBASE_CREDENTIAL, "base64").toString(
  "utf-8"
);

// Firebase Admin SDK는 같은 앱을 두 번 초기화하면 에러. 중복 방지
if (!admin.apps.length) {
  admin.initializeApp({
    // firebase credential json 파일 전체 내용이 들어와야 함
    credential: admin.credential.cert(JSON.parse(credentialJson)),
    // gs://my-ai-traider.appspot.com 여기서 gs://이런거 빼고 저장한 값임
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });
}

// Firebase Storage 인스턴스 생성 (Storage 사용시)
export const firebaseStorage = admin.storage().bucket();

/**
 * Firebase Storage 상대 경로를 전체 공개 URL로 변환
 * @param filePath 상대 경로 (예: "profile-image/1/uuid.png")
 * @returns 전체 URL (예: "https://storage.googleapis.com/bucket-name/profile-image/1/uuid.png")
 */
export const getStoragePublicUrl = (
  filePath: string | null | undefined
): string | null => {
  if (!filePath) return null;
  return `https://storage.googleapis.com/${env.FIREBASE_STORAGE_BUCKET}/${filePath}`;
};
