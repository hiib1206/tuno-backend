import { userModel } from "../generated/prisma/models/user";
import { toPublicUrl } from "./firebase";

/**
 * User 객체를 응답용으로 변환
 * - pw 제거
 * - profile_image_url을 전체 URL로 변환
 */
export const toUserResponse = (user: userModel) => {
  const { pw, profile_image_url, ...userWithoutPw } = user;

  return {
    ...userWithoutPw,
    profile_image_url: toPublicUrl(profile_image_url),
  };
};
