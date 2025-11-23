import { UserModel } from "../generated/prisma/models/User";
import { getStoragePublicUrl } from "../config/firebase";

/**
 * User 객체를 응답용으로 변환
 * - password 제거
 * - profileImageUrl을 전체 URL로 변환
 */
export const toUserResponse = (user: UserModel) => {
  const { pw, profileImageUrl, ...userWithoutPw } = user;

  return {
    ...userWithoutPw,
    profileImageUrl: getStoragePublicUrl(profileImageUrl),
  };
};
