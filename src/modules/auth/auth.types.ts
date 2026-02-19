export const AUTH_PROVIDERS = {
  LOCAL: "local",
  NAVER: "naver",
  KAKAO: "kakao",
  GOOGLE: "google",
} as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];

export function isValidAuthProvider(value: string): value is AuthProvider {
  return Object.values(AUTH_PROVIDERS).includes(value as AuthProvider);
}
