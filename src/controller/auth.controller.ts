import bcrypt from "bcrypt";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import type { Profile } from "passport-google-oauth20";
import { env } from "../config/env";
import passport from "../config/passport";
import prisma from "../config/prisma";
import redis from "../config/redis";
import { AUTH_PROVIDERS } from "../types/auth-provider";
import { generateOAuthState, verifyOAuthState } from "../utils/auth";
import { sendError, sendSuccess } from "../utils/commonResponse";
import {
  generateVerificationCode,
  maskUsername,
  sendFindUsernameEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../utils/email";
import { generateNick } from "../utils/nick";
import { getClientIp, getDeviceId, getUserAgent } from "../utils/request";
import {
  clearRefreshTokenCookie,
  deleteAllRefreshTokens,
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
    const trimmed = decoded.trim();

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

    // 반환 값 : %2Fmypage 등 인코딩된 값
    return encodeURIComponent(decoded);
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
    const { username, pw, nick, email, signupToken } = req.validated?.body;

    // 1. signupToken 검증 (이메일 인증 완료 여부 확인)
    const redisKey = `email_auth:${email}`;
    const authDataString = await redis.get(redisKey);

    if (!authDataString) {
      return sendError(
        res,
        400,
        "이메일 인증이 만료되었습니다. 다시 인증해주세요."
      );
    }

    const authData = JSON.parse(authDataString);

    // 인증 완료 여부 확인
    if (authData.verified !== true) {
      return sendError(res, 400, "이메일 인증이 완료되지 않았습니다.");
    }

    // signupToken 일치 확인
    if (authData.signupToken !== signupToken) {
      return sendError(res, 400, "이메일 인증에 실패 하였습니다.");
    }

    // 2. 기존 사용자 확인
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

    // 이메일 중복 확인
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return sendError(res, 400, "이미 사용 중인 이메일입니다.");
    }

    // 3. 비밀번호 해시
    const hashedPw = await bcrypt.hash(pw, 10);

    // 4. 사용자 생성 (이메일 및 인증 정보 포함)
    await prisma.user.create({
      data: {
        username,
        pw: hashedPw,
        nick,
        email,
        email_verified_at: new Date(), // 이메일 인증 완료
        auth_providers: {
          create: {
            provider: AUTH_PROVIDERS.LOCAL,
            provider_user_id: null,
          },
        },
      },
    });

    // 5. 사용된 signupToken 무효화 (Redis에서 삭제)
    await redis.del(redisKey);

    return sendSuccess(res, 201, "회원가입이 완료되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 이메일 인증 요청
export const sendEmailVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.validated?.body;

    // 6자리 인증 코드 생성
    const code = generateVerificationCode();

    // 코드 해시 생성
    const codeHash = await bcrypt.hash(code, 10);

    // Redis에 저장할 데이터
    const authData = {
      codeHash,
      verified: false,
      signupToken: null,
      attempts: 0,
    };

    // Redis에 저장 (기존 데이터 덮어쓰기)
    const redisKey = `email_auth:${email}`;
    await redis.set(redisKey, JSON.stringify(authData), "EX", 300); //5분

    // 이메일 발송
    await sendVerificationEmail(email, code);

    return sendSuccess(res, 200, "인증 코드가 이메일로 발송되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 이메일 인증 재발송
export const resendEmailVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.validated?.body;

    // 이메일 중복 확인
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return sendError(res, 400, "이미 사용 중인 이메일입니다.");
    }

    // 1. 재발송 쿨타임 체크
    const resendKey = `email_auth_resend:${email}`;
    if (await redis.exists(resendKey)) {
      return sendError(res, 400, "60초 후 다시 시도해주세요.");
    }

    // 2. 쿨타임 설정 (먼저 실행 - race condition 방지)
    await redis.set(resendKey, "1", "EX", 60); // 60초

    // 3. 새 인증 코드 생성
    const code = generateVerificationCode();

    // 4. 코드 해시 생성
    const codeHash = await bcrypt.hash(code, 10);

    // 5. 인증 정보 초기화 (기존 코드/signupToken 완전 무효화)
    const authData = {
      codeHash,
      verified: false,
      signupToken: null,
      attempts: 0,
    };

    const redisKey = `email_auth:${email}`;
    await redis.set(redisKey, JSON.stringify(authData), "EX", 300); // 5분

    // 6. 이메일 발송
    await sendVerificationEmail(email, code);

    return sendSuccess(res, 200, "인증 코드가 재전송되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 이메일 인증 검증 (signupToken 발급)
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, code } = req.validated?.body;

    // Redis에서 인증 데이터 조회
    const redisKey = `email_auth:${email}`;
    const authDataString = await redis.get(redisKey);

    // TTL 만료 여부 확인
    if (!authDataString) {
      return sendError(res, 400, "인증 코드가 만료되었거나 존재하지 않습니다.");
    }

    const authData = JSON.parse(authDataString);

    // 이미 인증 완료된 경우 기존 signupToken 반환
    if (authData.verified === true) {
      return sendSuccess(res, 200, "이미 인증이 완료되었습니다.", {
        signupToken: authData.signupToken,
      });
    }

    // attempts >= 5 체크
    if (authData.attempts >= 5) {
      return sendError(
        res,
        400,
        "최대 시도 횟수를 초과했습니다. 새로운 인증 코드를 발급받아주세요.",
        {
          attempts: authData.attempts,
          maxAttempts: 5,
        }
      );
    }

    // 코드 검증
    const isCodeValid = await bcrypt.compare(code, authData.codeHash);

    if (!isCodeValid) {
      // 실패 시 attempts + 1
      authData.attempts += 1;

      // 기존 TTL 유지하여 Redis 갱신
      const ttl = await redis.ttl(redisKey);
      // -2: 키가 없음, -1: 키는 있지만 TTL 없음
      if (ttl > 0) {
        await redis.set(redisKey, JSON.stringify(authData), "EX", ttl);
      } else {
        // TTL이 만료되었거나 설정되지 않은 경우 에러 반환
        return sendError(
          res,
          400,
          "인증 코드가 만료되었습니다. 새로운 인증 코드를 발급받아주세요."
        );
      }

      return sendError(res, 400, "인증 코드가 일치하지 않습니다.", {
        attempts: authData.attempts,
        maxAttempts: 5,
      });
    }

    // 성공 시 처리
    authData.verified = true;

    // signupToken 재발급 정책: 없을 때만 발급
    if (!authData.signupToken) {
      authData.signupToken = crypto.randomUUID();
    }

    // Redis 갱신 (TTL 300초로 리셋)
    await redis.set(redisKey, JSON.stringify(authData), "EX", 300);

    return sendSuccess(res, 200, "이메일 인증이 완료되었습니다.", {
      signupToken: authData.signupToken,
    });
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
      where: { username, deleted_at: null },
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

    // 탈퇴한 사용자는 로그인 불가
    if (user?.deleted_at) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`
      );
    }

    // 2단계: email로 조회 (일반 회원가입 사용자와 통합)
    if (!user && email) {
      user = await prisma.user.findUnique({
        where: { email, deleted_at: null },
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

    // 3단계: 신규 사용자 생성 (nick 충돌 시 재시도)
    if (!user) {
      const MAX_RETRY = 3;
      for (let i = 0; i < MAX_RETRY; i++) {
        try {
          user = await prisma.user.create({
            data: {
              email,
              nick: generateNick(),
              email_verified_at: new Date(),
              auth_providers: {
                create: {
                  provider,
                  provider_user_id: providerId,
                },
              },
            },
          });
          break;
        } catch (e: any) {
          if (e.code !== "P2002" || i === MAX_RETRY - 1) throw e;
        }
      }
    }

    // 4. JWT 토큰 생성 및 저장
    const refreshToken = generateRefreshToken();
    const userAgent = getUserAgent(req);
    const clientIp = getClientIp(req);

    await saveRefreshToken(
      user!.id,
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

    // 탈퇴한 사용자는 로그인 불가
    if (user?.deleted_at) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`
      );
    }

    // 2단계: 신규 사용자 생성 (nick 충돌 시 재시도)
    // Naver는 email 기반 통합을 하지 않음 (email이 연락처용이므로 신뢰 불가)
    if (!user) {
      const MAX_RETRY = 3;
      for (let i = 0; i < MAX_RETRY; i++) {
        try {
          user = await prisma.user.create({
            data: {
              nick: generateNick(),
              auth_providers: {
                create: {
                  provider,
                  provider_user_id: providerId,
                },
              },
            },
          });
          break;
        } catch (e: any) {
          if (e.code !== "P2002" || i === MAX_RETRY - 1) throw e;
        }
      }
    }

    // 4. 토큰 생성 및 저장
    const refreshToken = generateRefreshToken();
    const userAgent = getUserAgent(req);
    const clientIp = getClientIp(req);

    await saveRefreshToken(
      user!.id,
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

    // 탈퇴한 사용자는 로그인 불가
    if (user?.deleted_at) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`
      );
    }

    // 2단계: 신규 사용자 생성 (nick 충돌 시 재시도)
    // Kakao는 email 기반 통합을 하지 않음 (email이 신뢰할 수 없을 수 있음)
    if (!user) {
      const MAX_RETRY = 3;
      for (let i = 0; i < MAX_RETRY; i++) {
        try {
          user = await prisma.user.create({
            data: {
              nick: generateNick(),
              auth_providers: {
                create: {
                  provider,
                  provider_user_id: providerId,
                },
              },
            },
          });
          break;
        } catch (e: any) {
          if (e.code !== "P2002" || i === MAX_RETRY - 1) throw e;
        }
      }
    }

    // 6. JWT 토큰 생성 및 저장
    const refreshToken = generateRefreshToken();
    const userAgent = getUserAgent(req);
    const clientIp = getClientIp(req);

    await saveRefreshToken(
      user!.id,
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

// 아이디 찾기
export const findUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.validated?.body;

    const user = await prisma.user.findUnique({
      where: { email, deleted_at: null },
      select: { username: true },
    });

    if (user && user.username) {
      const masked = maskUsername(user.username);
      await sendFindUsernameEmail(email, masked);
    }

    return sendSuccess(res, 200, "이메일이 발송되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 비밀번호 재설정 요청
export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, email } = req.validated?.body;

    const user = await prisma.user.findFirst({
      where: {
        username,
        email,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (user) {
      const resetToken = crypto.randomUUID();

      const redisKey = `password_reset:${resetToken}`;
      const resetData = { userId: user.id };
      await redis.set(redisKey, JSON.stringify(resetData), "EX", 300);

      await sendPasswordResetEmail(email, resetToken);
    }

    // 보안으로 사용자가 존재하지 않는 경우에도 응답
    return sendSuccess(res, 200, "이메일이 발송되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 비밀번호 재설정
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, newPw } = req.validated?.body;

    const redisKey = `password_reset:${token}`;
    const resetDataString = await redis.get(redisKey);

    if (!resetDataString) {
      return sendError(res, 400, "유효하지 않거나 만료된 토큰입니다.");
    }

    const resetData = JSON.parse(resetDataString);
    const userId = resetData.userId;

    const hashedPw = await bcrypt.hash(newPw, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { pw: hashedPw },
    });

    await redis.del(redisKey);

    await deleteAllRefreshTokens(userId);

    return sendSuccess(res, 200, "비밀번호가 성공적으로 변경되었습니다.");
  } catch (error) {
    next(error);
  }
};
