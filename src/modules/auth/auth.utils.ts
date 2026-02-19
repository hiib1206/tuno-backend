import crypto from "crypto";
import redis from "../../config/redis";

export const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OAuthState {
  deviceId: unknown;
  redirect?: string;
  csrf: string;
}

/**
 * OAuth state를 생성하고 Redis에 저장한다.
 *
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

  await redis.setex(`oauth_state:${stateObj.csrf}`, 300, "1");

  return state;
};

/**
 * OAuth state를 검증하고 deviceId, redirect를 추출한다.
 *
 * @throws {@link Error} 검증 실패 시
 */
export const verifyOAuthState = async (
  stateParam: unknown
): Promise<{ deviceId: unknown; redirect?: string }> => {
  if (!stateParam || typeof stateParam !== "string") {
    throw new Error("잘못된 state 파라미터입니다.");
  }

  let stateObj: OAuthState;
  try {
    const decoded = Buffer.from(stateParam, "base64url").toString("utf-8");
    stateObj = JSON.parse(decoded);
  } catch {
    throw new Error("state 형식이 올바르지 않습니다.");
  }

  const storedState = await redis.get(`oauth_state:${stateObj.csrf}`);
  if (!storedState) {
    throw new Error("state가 만료되었거나 유효하지 않습니다.");
  }

  // 재사용 방지를 위해 즉시 삭제
  await redis.del(`oauth_state:${stateObj.csrf}`);

  return {
    deviceId: stateObj.deviceId,
    redirect: stateObj.redirect,
  };
};

/**
 * 안전한 redirect 경로를 생성한다.
 *
 * @remarks
 * 내부 경로만 허용하고 외부 URL, 상위 디렉토리 접근 등을 차단한다.
 *
 * @returns URL 인코딩된 안전한 경로 또는 빈 문자열
 */
export function sanitizeRedirect(rawRedirect?: string): string {
  if (!rawRedirect) return "";

  try {
    const decoded = decodeURIComponent(rawRedirect);
    const trimmed = decoded.trim();

    if (!trimmed.startsWith("/")) return "";
    if (/^https?:\/\//i.test(trimmed)) return "";
    if (trimmed.startsWith("//")) return "";
    if (trimmed.includes("..")) return "";
    if (/[\x00-\x1F\x7F]/.test(trimmed)) return "";

    return encodeURIComponent(decoded);
  } catch {
    return "";
  }
}

/** redirect 쿼리 파라미터 문자열을 생성한다. */
export const buildRedirectParam = (redirect?: string): string => {
  return redirect ? `&redirect=${redirect}` : "";
};
