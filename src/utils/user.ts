import { getStoragePublicUrl } from "../config/firebase";
import { userModel } from "../generated/prisma/models/user";

/**
 * User 객체를 응답용으로 변환
 * - pw 제거
 * - profile_image_url을 전체 URL로 변환
 */
export const toUserResponse = (user: userModel) => {
  const { pw, profile_image_url, ...userWithoutPw } = user;

  return {
    ...userWithoutPw,
    profile_image_url: getStoragePublicUrl(profile_image_url),
  };
};
