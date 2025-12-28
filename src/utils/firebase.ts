import { env } from "../config/env";

/**
 * Firebase Storage 상대 경로를 전체 공개 URL로 변환
 * @param filePath 상대 경로 (예: "profile-image/1/uuid.png")
 * @returns 전체 URL (예: "https://storage.googleapis.com/bucket-name/profile-image/1/uuid.png")
 */
export const toPublicUrl = (
  filePath: string | null | undefined
): string | null => {
  if (!filePath) return null;
  return `https://storage.googleapis.com/${env.FIREBASE_STORAGE_BUCKET}/${filePath}`;
};

/**
 * 문자열 배열에서 Firebase 공개 URL만 필터링하여 반환
 * @param urls 문자열 배열
 * @returns Firebase 공개 URL만 포함된 배열, 하나도 없으면 빈 배열 반환
 */
export const filterStoragePublicUrls = (urls: string[]): string[] => {
  return urls.filter((url) => {
    if (!url || typeof url !== "string") return false;
    // Firebase Storage 공개 URL 패턴 확인
    return url.startsWith(
      `https://storage.googleapis.com/${env.FIREBASE_STORAGE_BUCKET}/`
    );
  });
};

/**
 * Firebase Storage 공개 URL에서 상대 경로를 추출
 * @param publicUrl 공개 URL (예: "https://storage.googleapis.com/bucket-name/temp/post-images/1/uuid.png")
 * @returns 상대 경로 (예: "temp/post-images/1/uuid.png")
 */
export const extractPathFromUrl = (publicUrl: string): string | null => {
  const bucketPrefix = `https://storage.googleapis.com/${env.FIREBASE_STORAGE_BUCKET}/`;
  if (!publicUrl.startsWith(bucketPrefix)) {
    return null;
  }
  return publicUrl.replace(bucketPrefix, "");
};
