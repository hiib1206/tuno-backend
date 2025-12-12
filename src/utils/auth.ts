import crypto from "crypto";
import redis from "../config/redis";

interface OAuthState {
  deviceId: unknown;
  redirect?: string;
  csrf: string;
}

/**
 * OAuth state 생성 및 Redis 저장
 * @param deviceId - 디바이스 ID (query string에서 올 수 있는 타입)
 * @param redirect - 리다이렉트 경로 (선택적)
 * @returns base64url로 인코딩된 state 문자열
 */
export const generateOAuthState = async (
  deviceId: unknown,
  redirect?: string
): Promise<string> => {
  const stateObj: OAuthState = {
    deviceId,
    redirect,
    csrf: crypto.randomBytes(16).toString("hex"),
  };
  const state = Buffer.from(JSON.stringify(stateObj)).toString("base64url");

  // state를 임시 저장소(redis)에 보관 (5분 유효)
  await redis.setex(`oauth_state:${stateObj.csrf}`, 300, "1");

  return state;
};

/**
 * OAuth state 검증 및 deviceId, redirect 추출
 * @param stateParam - OAuth 콜백에서 받은 state 파라미터
 * @returns { deviceId, redirect } (검증 성공 시)
 * @throws 검증 실패 시 에러
 */
export const verifyOAuthState = async (
  stateParam: unknown
): Promise<{ deviceId: unknown; redirect?: string }> => {
  // state 파라미터 검증
  if (!stateParam || typeof stateParam !== "string") {
    throw new Error("잘못된 state 파라미터입니다.");
  }

  // state 디코딩
  let stateObj: OAuthState;
  try {
    const decoded = Buffer.from(stateParam, "base64url").toString("utf-8");
    stateObj = JSON.parse(decoded);
  } catch (error) {
    throw new Error("state 형식이 올바르지 않습니다.");
  }

  // Redis에서 CSRF 토큰 검증
  const storedState = await redis.get(`oauth_state:${stateObj.csrf}`);
  if (!storedState) {
    throw new Error("state가 만료되었거나 유효하지 않습니다.");
  }

  // 사용 후 즉시 삭제 (재사용 방지)
  await redis.del(`oauth_state:${stateObj.csrf}`);

  return {
    deviceId: stateObj.deviceId,
    redirect: stateObj.redirect,
  };
};
