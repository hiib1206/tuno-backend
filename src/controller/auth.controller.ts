import bcrypt from "bcrypt";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import type { Profile } from "passport-google-oauth20";
import { env } from "../config/env";
import passport from "../config/passport";
import prisma from "../config/prisma";
import { AUTH_PROVIDERS } from "../types/auth-provider";
import { generateOAuthState, verifyOAuthState } from "../utils/auth";
import { sendError, sendSuccess } from "../utils/commonResponse";
import { getClientIp, getDeviceId, getUserAgent } from "../utils/request";
import {
  clearRefreshTokenCookie,
  deleteRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  getUserIdAndDeviceIdFromToken,
  saveRefreshToken,
  setRefreshTokenCookie,
  UserPayload,
} from "../utils/token";
import { toUserResponse } from "../utils/user";

// UUID 형식 검증 (모든 UUID 버전 지원)
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 안전한 redirect 경로 생성 헬퍼 함수
export function sanitizeRedirect(rawRedirect?: string): string {
  if (!rawRedirect) return "";

  try {
    const decoded = decodeURIComponent(rawRedirect);
    const normalized = decoded.split(/[?#]/)[0]; // 쿼리·해시 제거
    const trimmed = normalized.trim();

    // 내부 경로(`/`로 시작)만 허용
    if (!trimmed.startsWith("/")) return "";

    // 절대 URL 차단 (http://, https://)
    if (/^https?:\/\//i.test(trimmed)) return "";

    // 프로토콜 상대 URL 차단 (//evil.com)
    if (trimmed.startsWith("//")) return "";

    // 상위 디렉토리 접근 차단
    if (trimmed.includes("..")) return "";

    // 제어문자 방지
    if (/[\x00-\x1F\x7F]/.test(trimmed)) return "";

    // ✅ 허용된 경로 prefix 목록
    const ALLOWED_PREFIXES = ["/analysis", "/community"];

    // 접두사(prefix) 기반 허용
    const isAllowed = ALLOWED_PREFIXES.some((prefix) =>
      trimmed.startsWith(prefix)
    );

    // 반환 값 : %2Fmypage 등 인코딩된 값
    return isAllowed ? encodeURIComponent(decoded) : "";
  } catch {
    return "";
  }
}

// redirect 쿼리 파라미터 생성 헬퍼 함수
// 반환 예시: redirect가 있으면 '&redirect=%2Fmypage'와 같은 문자열, 없으면 빈 문자열('') 반환
const buildRedirectParam = (redirect?: string): string => {
  return redirect ? `&redirect=${redirect}` : "";
};

// 회원가입
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, pw, nick } = req.body;

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return sendError(res, 400, "이미 존재하는 아이디입니다.");
    }

    const existingNick = await prisma.user.findUnique({
      where: { nick },
    });

    if (existingNick) {
      return sendError(res, 400, "이미 존재하는 닉네임입니다.");
    }

    const hashedPw = await bcrypt.hash(pw, 10);

    await prisma.user.create({
      data: {
        username,
        pw: hashedPw,
        nick,
        auth_providers: {
          create: {
            provider: AUTH_PROVIDERS.LOCAL,
            provider_user_id: null,
          },
        },
      },
    });

    return sendSuccess(res, 201, "회원가입이 완료되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 로그인
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, pw } = req.body;

    if (!username || !pw) {
      return sendError(res, 400, "아이디와 비밀번호를 입력해주세요.");
    }
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return sendError(res, 400, "아이디 또는 비밀번호가 일치하지 않습니다.");
    }

    if (!user.pw) {
      return sendError(
        res,
        400,
        "소셜 로그인 계정은 일반 로그인할 수 없습니다."
      );
    }

    const isPasswordValid = await bcrypt.compare(pw, user.pw);
    if (!isPasswordValid) {
      return sendError(res, 400, "아이디 또는 비밀번호가 일치하지 않습니다.");
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const deviceId = getDeviceId(req);

    // deviceId는 필수 (전역 미들웨어가 형식만 검증하므로 존재 여부는 컨트롤러에서 검증)
    if (!deviceId) {
      return sendError(res, 400, "x-device-id 헤더가 필요합니다.");
    }

    const userAgent = getUserAgent(req);
    const clientIp = getClientIp(req);

    // Redis에 리프레시 토큰 저장
    await saveRefreshToken(
      user.id,
      deviceId,
      refreshToken,
      userAgent,
      clientIp,
      env.REFRESH_TOKEN_EXPIRES_IN
    );

    setRefreshTokenCookie(res, refreshToken);

    return sendSuccess(res, 200, "로그인이 완료되었습니다.", {
      accessToken,
      user: toUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// refresh
export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const oldRefreshToken = req.refreshToken;
    const oldDeviceId = req.deviceId;

    // 기존 리프레시 토큰 삭제
    if (oldRefreshToken && oldDeviceId) {
      await deleteRefreshToken(userId, oldDeviceId);
    }

    // 새 리프레시 토큰 생성 및 저장
    const accessToken = generateAccessToken(userId);
    const refreshToken = generateRefreshToken();
    const deviceId = getDeviceId(req);

    // deviceId는 필수 (전역 미들웨어가 형식만 검증하므로 존재 여부는 컨트롤러에서 검증)
    if (!deviceId) {
      return sendError(res, 400, "x-device-id 헤더가 필요합니다.");
    }

    const userAgent = getUserAgent(req);
    const clientIp = getClientIp(req);

    await saveRefreshToken(
      userId,
      deviceId,
      refreshToken,
      userAgent,
      clientIp,
      env.REFRESH_TOKEN_EXPIRES_IN
    );

    setRefreshTokenCookie(res, refreshToken);

    return sendSuccess(res, 200, "토큰 갱신이 완료되었습니다.", {
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// 로그아웃
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    // Redis에서 리프레시 토큰 삭제
    if (refreshToken) {
      // tokenInfo: { userId: number, deviceId: string } or null
      const tokenInfo = await getUserIdAndDeviceIdFromToken(refreshToken);
      if (tokenInfo) {
        await deleteRefreshToken(tokenInfo.userId, tokenInfo.deviceId);
      }
    }

    clearRefreshTokenCookie(res);
    return sendSuccess(res, 200, "로그아웃이 완료되었습니다.");
  } catch (error) {
    next(error);
  }
};

// Google OAuth 시작
export const google = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceId, redirect } = req.query as any;

    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    // deviceId는 필수이며 UUID 형식이어야 함
    if (!deviceId || !uuidRegex.test(deviceId)) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`
      );
    }

    const state = await generateOAuthState(deviceId, redirect);

    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
      state,
    } as any)(req, res, (err: any) => {
      // passport.authenticate의 에러는 여기서 처리
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`
      );
    });
  } catch (error) {
    // 에러 발생 시 프론트엔드로 리다이렉트
    const redirect = req.query.redirect as string | undefined;
    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    return res.redirect(
      `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`
    );
  }
};

// Google OAuth 콜백 처리
export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. state 검증 및 deviceId, redirect 추출 (CSRF 보호 - 가장 먼저 수행)
    let stateData: { deviceId: unknown; redirect?: string };
    try {
      stateData = await verifyOAuthState(req.query.state);
    } catch (error) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=google_login_failed`
      );
    }

    const { deviceId, redirect } = stateData;

    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));

    if (!deviceId || typeof deviceId !== "string") {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`
      );
    }

    // 2. profile 검증
    const profile = req.user as Profile;

    if (
      !profile ||
      !profile.emails ||
      !profile.emails[0] ||
      !profile.id ||
      profile.provider !== "google"
    ) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`
      );
    }

    const email = profile.emails[0].value;
    const displayName = profile.displayName || email.split("@")[0];
    const provider = AUTH_PROVIDERS.GOOGLE;
    const providerId = profile.id;

    // 1단계: provider + provider_id로 조회 (이미 소셜 계정이 연결된 경우)
    const authProvider = await prisma.auth_provider.findUnique({
      where: {
        provider_provider_user_id: {
          provider,
          provider_user_id: providerId,
        },
      },
      include: { user: true },
    });
    let user = authProvider?.user ?? null;

    // 2단계: email로 조회 (일반 회원가입 사용자와 통합)
    if (!user && email) {
      user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // 계정 통합: provider 정보 추가
        // 기존 비밀번호는 유지 (일반 로그인도 가능하도록)
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            // email_verified_at이 없으면 설정 (소셜 로그인은 인증 완료)
            email_verified_at: user.email_verified_at || new Date(),
            auth_providers: {
              create: {
                provider,
                provider_user_id: providerId,
              },
            },
          },
        });
      }
    }

    // 3단계: 신규 사용자 생성
    if (!user) {
      // nick은 중복 방지를 위해 랜덤 문자열 추가
      // 예) nick_a4f3
      const shortId = crypto.randomBytes(4).toString("hex");
      const nick = `${displayName}_${shortId}`;

      user = await prisma.user.create({
        data: {
          email,
          nick,
          email_verified_at: new Date(), // Google 로그인은 이메일이 이미 인증됨
          auth_providers: {
            create: {
              provider,
              provider_user_id: providerId,
            },
          },
        },
      });
    }

    // 4. JWT 토큰 생성 및 저장
    const refreshToken = generateRefreshToken();
    const userAgent = getUserAgent(req);
    const clientIp = getClientIp(req);

    await saveRefreshToken(
      user.id,
      deviceId,
      refreshToken,
      userAgent,
      clientIp,
      env.REFRESH_TOKEN_EXPIRES_IN
    );

    setRefreshTokenCookie(res, refreshToken);

    // 프론트엔드로 리다이렉트 (성공)
    return res.redirect(
      `${env.FRONTEND_URL}/login?oauth_success=true${redirectParam}`
    );
  } catch (error) {
    // 실패 시 프론트엔드로 리다이렉트
    return res.redirect(`${env.FRONTEND_URL}/login?error=google_login_failed`);
  }
};

// Naver OAuth 시작
export const naver = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceId, redirect } = req.query as any;

    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    // deviceId는 필수이며 UUID 형식이어야 함
    if (!deviceId || !uuidRegex.test(deviceId)) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`
      );
    }

    const state = await generateOAuthState(deviceId, redirect);

    passport.authenticate("naver", {
      session: false,
      state,
    } as any)(req, res, (err: any) => {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`
      );
    });
  } catch (error) {
    // 에러 발생 시 프론트엔드로 리다이렉트
    const redirect = req.query.redirect as string | undefined;
    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    return res.redirect(
      `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`
    );
  }
};

// Naver OAuth 콜백 처리
export const naverCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. state 검증 및 deviceId, redirect 추출 (CSRF 보호 - 가장 먼저 수행)
    let stateData: { deviceId: unknown; redirect?: string };
    try {
      stateData = await verifyOAuthState(req.query.state);
    } catch (error) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=naver_login_failed`);
    }

    const { deviceId, redirect } = stateData;

    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));

    if (!deviceId || typeof deviceId !== "string") {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`
      );
    }

    // 2. profile 검증
    const profile = req.user as any; // 네이버 프로필 타입

    if (!profile || !profile.id || profile.provider !== "naver") {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`
      );
    }

    const provider = AUTH_PROVIDERS.NAVER;
    const providerId = profile.id;
    // 네이버는 profile.email이 연락처용 이메일이므로 신뢰할 수 없음
    const displayName = profile.nickname || profile.name || `user`;

    // 1단계: provider + provider_id로 조회 (이미 소셜 계정이 연결된 경우)
    const authProvider = await prisma.auth_provider.findUnique({
      where: {
        provider_provider_user_id: {
          provider,
          provider_user_id: providerId,
        },
      },
      include: { user: true },
    });
    let user = authProvider?.user ?? null;

    // 2단계: 신규 사용자 생성
    // Naver는 email 기반 통합을 하지 않음 (email이 연락처용이므로 신뢰 불가)
    if (!user) {
      // nick은 중복 방지를 위해 랜덤 문자열 추가
      const shortId = crypto.randomBytes(4).toString("hex");
      const nick = `${displayName}_${shortId}`;

      user = await prisma.user.create({
        data: {
          nick,
          auth_providers: {
            create: {
              provider,
              provider_user_id: providerId,
            },
          },
        },
      });
    }

    // 4. 토큰 생성 및 저장
    const refreshToken = generateRefreshToken();
    const userAgent = getUserAgent(req);
    const clientIp = getClientIp(req);

    await saveRefreshToken(
      user.id,
      deviceId,
      refreshToken,
      userAgent,
      clientIp,
      env.REFRESH_TOKEN_EXPIRES_IN
    );

    setRefreshTokenCookie(res, refreshToken);

    // 프론트엔드로 리다이렉트 (성공)
    return res.redirect(
      `${env.FRONTEND_URL}/login?oauth_success=true${redirectParam}`
    );
  } catch (error) {
    // 실패 시 프론트엔드로 리다이렉트
    return res.redirect(`${env.FRONTEND_URL}/login?error=naver_login_failed`);
  }
};

// Kakao OAuth 시작
export const kakao = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceId, redirect } = req.query as any;

    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    // deviceId는 필수이며 UUID 형식이어야 함
    if (!deviceId || !uuidRegex.test(deviceId)) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`
      );
    }

    const state = await generateOAuthState(deviceId, redirect);

    passport.authenticate("kakao", {
      session: false,
      state,
    } as any)(req, res, (err: any) => {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`
      );
    });
  } catch (error) {
    // 에러 발생 시 프론트엔드로 리다이렉트
    const redirect = req.query.redirect as string | undefined;
    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    return res.redirect(
      `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`
    );
  }
};

// Kakao OAuth 콜백 처리
export const kakaoCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. state 검증 및 deviceId, redirect 추출 (CSRF 보호 - 가장 먼저 수행)
    let stateData: { deviceId: unknown; redirect?: string };
    try {
      stateData = await verifyOAuthState(req.query.state);
    } catch (error) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=kakao_login_failed`);
    }

    const { deviceId, redirect } = stateData;

    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));

    if (!deviceId || typeof deviceId !== "string") {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`
      );
    }

    // 2. profile 검증
    const profile = req.user as any; // 카카오 프로필 타입

    if (!profile || !profile.id || profile.provider !== "kakao") {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`
      );
    }

    const provider = AUTH_PROVIDERS.KAKAO;
    const providerId = String(profile.id); // 숫자로 올 수 있으므로 문자열로 변환
    // 카카오는 이메일을 제공할 수 있지만 신뢰할 수 없으므로 email 기반 통합을 하지 않음
    const displayName = profile.displayName || profile.username || `kakao`;

    // 1단계: provider + provider_id로 조회 (이미 소셜 계정이 연결된 경우)
    const authProvider = await prisma.auth_provider.findUnique({
      where: {
        provider_provider_user_id: {
          provider,
          provider_user_id: providerId,
        },
      },
      include: { user: true },
    });
    let user = authProvider?.user ?? null;

    // 2단계: 신규 사용자 생성
    // Kakao는 email 기반 통합을 하지 않음 (email이 신뢰할 수 없을 수 있음)
    if (!user) {
      // nick은 중복 방지를 위해 랜덤 문자열 추가
      const shortId = crypto.randomBytes(4).toString("hex");
      const nick = `${displayName}_${shortId}`;

      user = await prisma.user.create({
        data: {
          nick,
          auth_providers: {
            create: {
              provider,
              provider_user_id: providerId,
            },
          },
        },
      });
    }

    // 6. JWT 토큰 생성 및 저장
    const refreshToken = generateRefreshToken();
    const userAgent = getUserAgent(req);
    const clientIp = getClientIp(req);

    await saveRefreshToken(
      user.id,
      deviceId,
      refreshToken,
      userAgent,
      clientIp,
      env.REFRESH_TOKEN_EXPIRES_IN
    );

    setRefreshTokenCookie(res, refreshToken);

    // 프론트엔드로 리다이렉트 (성공)
    return res.redirect(
      `${env.FRONTEND_URL}/login?oauth_success=true${redirectParam}`
    );
  } catch (error) {
    // 실패 시 프론트엔드로 리다이렉트
    return res.redirect(`${env.FRONTEND_URL}/login?error=kakao_login_failed`);
  }
};
