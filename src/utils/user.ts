import { userModel } from "../generated/prisma/models/user";
import { AuthProvider } from "../types/auth-provider";
import { toPublicUrl } from "./firebase";

type UserWithAuthProviders = userModel & {
  auth_providers?: Array<{
    id: number | null;
    user_id: number | null;
    provider: AuthProvider;
    provider_user_id: string | null;
    created_at: Date;
    updated_at: Date | null;
  }>;
};

/**
 * User 객체를 응답용으로 변환
 * - pw 제거
 * - profile_image_url을 전체 URL로 변환
 * - auth_providers가 있으면 포함 (provider_user_id는 제외)
 */
export const toUserResponse = (user: UserWithAuthProviders) => {
  const { pw, profile_image_url, auth_providers, ...userWithoutPw } = user;

  const response: any = {
    ...userWithoutPw,
    profile_image_url: toPublicUrl(profile_image_url),
  };

  // auth_providers가 있으면 포함 (provider_user_id는 보안상 제외)
  if (auth_providers && auth_providers.length > 0) {
    response.authProviders = auth_providers.map((ap) => ({
      provider: ap.provider,
      createdAt: ap.created_at,
    }));
  }

  return response;
};
