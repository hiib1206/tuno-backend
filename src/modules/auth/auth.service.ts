import bcrypt from "bcrypt";
import crypto from "crypto";
import type { Profile as GoogleProfile } from "passport-google-oauth20";
import { env } from "../../config/env";
import prisma from "../../config/prisma";
import redis from "../../config/redis";
import {
  deleteAllRefreshTokens,
  deleteRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  getUserIdAndDeviceIdFromToken,
  saveRefreshToken,
} from "../../shared/utils/token";
import {
  generateVerificationCode,
  maskUsername,
  sendFindUsernameEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../../shared/utils/email";
import { generateNick } from "../../shared/utils/nick";
import { BadRequestError } from "../../shared/errors/AppError";
import { toUserResponse } from "../user/user.utils";
import { AUTH_PROVIDERS, AuthProvider } from "./auth.types";
import { RegisterSchema } from "./auth.schema";
import {
  buildRedirectParam,
  sanitizeRedirect,
  verifyOAuthState,
} from "./auth.utils";

interface DeviceInfo {
  deviceId: string;
  userAgent: string;
  clientIp: string;
}

/** 이메일 인증 코드를 발송한다. */
export const sendEmailVerificationService = async (email: string) => {
  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);

  const authData = {
    codeHash,
    verified: false,
    signupToken: null,
    attempts: 0,
  };

  const redisKey = `email_auth:${email}`;
  await redis.set(redisKey, JSON.stringify(authData), "EX", 300);
  await sendVerificationEmail(email, code);

  return { data: null };
};

/** 이메일 인증 코드를 재발송한다. */
export const resendEmailVerificationService = async (email: string) => {
  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingEmail) {
    throw new BadRequestError("이미 사용 중인 이메일입니다.");
  }

  const resendKey = `email_auth_resend:${email}`;
  if (await redis.exists(resendKey)) {
    throw new BadRequestError("60초 후 다시 시도해주세요.");
  }

  // race condition 방지를 위해 쿨타임을 먼저 설정
  await redis.set(resendKey, "1", "EX", 60);

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);

  const authData = {
    codeHash,
    verified: false,
    signupToken: null,
    attempts: 0,
  };

  const redisKey = `email_auth:${email}`;
  await redis.set(redisKey, JSON.stringify(authData), "EX", 300);
  await sendVerificationEmail(email, code);

  return { data: null };
};

/** 이메일 인증 코드를 검증한다. */
export const verifyEmailService = async (email: string, code: string) => {
  const redisKey = `email_auth:${email}`;
  const authDataString = await redis.get(redisKey);

  if (!authDataString) {
    throw new BadRequestError("인증 코드가 만료되었거나 존재하지 않습니다.");
  }

  const authData = JSON.parse(authDataString);

  if (authData.verified === true) {
    return {
      data: {
        signupToken: authData.signupToken,
        alreadyVerified: true,
      },
    };
  }

  if (authData.attempts >= 5) {
    throw new BadRequestError(
      "최대 시도 횟수를 초과했습니다. 새로운 인증 코드를 발급받아주세요.",
      { attempts: authData.attempts, maxAttempts: 5 }
    );
  }

  const isCodeValid = await bcrypt.compare(code, authData.codeHash);

  if (!isCodeValid) {
    authData.attempts += 1;

    const ttl = await redis.ttl(redisKey);
    if (ttl > 0) {
      await redis.set(redisKey, JSON.stringify(authData), "EX", ttl);
    } else {
      throw new BadRequestError(
        "인증 코드가 만료되었습니다. 새로운 인증 코드를 발급받아주세요."
      );
    }

    throw new BadRequestError("인증 코드가 일치하지 않습니다.", {
      attempts: authData.attempts,
      maxAttempts: 5,
    });
  }

  authData.verified = true;

  if (!authData.signupToken) {
    authData.signupToken = crypto.randomUUID();
  }

  await redis.set(redisKey, JSON.stringify(authData), "EX", 300);

  return {
    data: {
      signupToken: authData.signupToken,
      alreadyVerified: false,
    },
  };
};

/** 회원가입을 처리한다. */
export const registerService = async (data: RegisterSchema) => {
  const { username, pw, nick, email, signupToken } = data;

  const redisKey = `email_auth:${email}`;
  const authDataString = await redis.get(redisKey);

  if (!authDataString) {
    throw new BadRequestError("이메일 인증이 만료되었습니다. 다시 인증해주세요.");
  }

  const authData = JSON.parse(authDataString);

  if (authData.verified !== true) {
    throw new BadRequestError("이메일 인증이 완료되지 않았습니다.");
  }

  if (authData.signupToken !== signupToken) {
    throw new BadRequestError("이메일 인증에 실패 하였습니다.");
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUsername) {
    throw new BadRequestError("이미 존재하는 아이디입니다.");
  }

  const existingNick = await prisma.user.findUnique({
    where: { nick },
  });

  if (existingNick) {
    throw new BadRequestError("이미 존재하는 닉네임입니다.");
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingEmail) {
    throw new BadRequestError("이미 사용 중인 이메일입니다.");
  }

  const hashedPw = await bcrypt.hash(pw, 10);

  await prisma.user.create({
    data: {
      username,
      pw: hashedPw,
      nick,
      email,
      email_verified_at: new Date(),
      auth_providers: {
        create: {
          provider: AUTH_PROVIDERS.LOCAL,
          provider_user_id: null,
        },
      },
    },
  });

  await redis.del(redisKey);

  return { data: null };
};

/** 로그인을 처리한다. */
export const loginService = async (
  username: string,
  pw: string,
  deviceInfo: DeviceInfo
) => {
  if (!username || !pw) {
    throw new BadRequestError("아이디와 비밀번호를 입력해주세요.");
  }

  const user = await prisma.user.findUnique({
    where: { username, deleted_at: null },
  });

  if (!user) {
    throw new BadRequestError("아이디 또는 비밀번호가 일치하지 않습니다.");
  }

  if (!user.pw) {
    throw new BadRequestError("소셜 로그인 계정은 일반 로그인할 수 없습니다.");
  }

  const isPasswordValid = await bcrypt.compare(pw, user.pw);
  if (!isPasswordValid) {
    throw new BadRequestError("아이디 또는 비밀번호가 일치하지 않습니다.");
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken();

  await saveRefreshToken(
    user.id,
    deviceInfo.deviceId,
    refreshToken,
    deviceInfo.userAgent,
    deviceInfo.clientIp,
    env.REFRESH_TOKEN_EXPIRES_IN
  );

  return {
    data: {
      accessToken,
      refreshToken,
      user: toUserResponse(user),
    },
  };
};

/** 토큰을 갱신한다. */
export const refreshService = async (
  userId: number,
  oldDeviceId: string | undefined,
  oldRefreshToken: string | undefined,
  deviceInfo: DeviceInfo
) => {
  if (oldRefreshToken && oldDeviceId) {
    await deleteRefreshToken(userId, oldDeviceId);
  }

  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken();

  await saveRefreshToken(
    userId,
    deviceInfo.deviceId,
    refreshToken,
    deviceInfo.userAgent,
    deviceInfo.clientIp,
    env.REFRESH_TOKEN_EXPIRES_IN
  );

  return {
    data: {
      accessToken,
      refreshToken,
    },
  };
};

/** 로그아웃을 처리한다. */
export const logoutService = async (refreshToken: string | undefined) => {
  if (refreshToken) {
    const tokenInfo = await getUserIdAndDeviceIdFromToken(refreshToken);
    if (tokenInfo) {
      await deleteRefreshToken(tokenInfo.userId, tokenInfo.deviceId);
    }
  }

  return { data: null };
};

/** 아이디 찾기를 처리한다. */
export const findUsernameService = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, deleted_at: null },
    select: { username: true },
  });

  if (user && user.username) {
    const masked = maskUsername(user.username);
    await sendFindUsernameEmail(email, masked);
  }

  return { data: null };
};

/** 비밀번호 재설정 요청을 처리한다. */
export const requestPasswordResetService = async (
  username: string,
  email: string
) => {
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

  return { data: null };
};

/** 비밀번호를 재설정한다. */
export const resetPasswordService = async (token: string, newPw: string) => {
  const redisKey = `password_reset:${token}`;
  const resetDataString = await redis.get(redisKey);

  if (!resetDataString) {
    throw new BadRequestError("유효하지 않거나 만료된 토큰입니다.");
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

  return { data: null };
};

interface OAuthDeviceInfo {
  userAgent: string;
  clientIp: string;
}

interface OAuthCallbackResult {
  data?: {
    redirectUrl: string;
    refreshToken: string;
  };
  error?: {
    redirectUrl: string;
  };
}

/** Google OAuth 콜백을 처리한다. */
export const processGoogleCallbackService = async (
  profile: GoogleProfile | undefined,
  stateParam: unknown,
  deviceInfo: OAuthDeviceInfo
): Promise<OAuthCallbackResult> => {
  let stateData: { deviceId: unknown; redirect?: string };
  try {
    stateData = await verifyOAuthState(stateParam);
  } catch (error) {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=google_login_failed`,
      },
    };
  }

  const { deviceId, redirect } = stateData;
  const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));

  if (!deviceId || typeof deviceId !== "string") {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`,
      },
    };
  }

  if (
    !profile ||
    !profile.emails ||
    !profile.emails[0] ||
    !profile.id ||
    profile.provider !== "google"
  ) {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`,
      },
    };
  }

  const email = profile.emails[0].value;
  const provider = AUTH_PROVIDERS.GOOGLE;
  const providerId = profile.id;

  let user = await findOrCreateOAuthUser(provider, providerId, email, true);

  if (!user || user.deleted_at) {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`,
      },
    };
  }

  const refreshToken = generateRefreshToken();

  await saveRefreshToken(
    user.id,
    deviceId,
    refreshToken,
    deviceInfo.userAgent,
    deviceInfo.clientIp,
    env.REFRESH_TOKEN_EXPIRES_IN
  );

  return {
    data: {
      redirectUrl: `${env.FRONTEND_URL}/login?oauth_success=true${redirectParam}`,
      refreshToken,
    },
  };
};

/** Naver OAuth 콜백을 처리한다. */
export const processNaverCallbackService = async (
  profile: any,
  stateParam: unknown,
  deviceInfo: OAuthDeviceInfo
): Promise<OAuthCallbackResult> => {
  let stateData: { deviceId: unknown; redirect?: string };
  try {
    stateData = await verifyOAuthState(stateParam);
  } catch (error) {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=naver_login_failed`,
      },
    };
  }

  const { deviceId, redirect } = stateData;
  const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));

  if (!deviceId || typeof deviceId !== "string") {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`,
      },
    };
  }

  if (!profile || !profile.id || profile.provider !== "naver") {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`,
      },
    };
  }

  const provider = AUTH_PROVIDERS.NAVER;
  const providerId = profile.id;

  let user = await findOrCreateOAuthUser(provider, providerId, undefined, false);

  if (!user || user.deleted_at) {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`,
      },
    };
  }

  const refreshToken = generateRefreshToken();

  await saveRefreshToken(
    user.id,
    deviceId,
    refreshToken,
    deviceInfo.userAgent,
    deviceInfo.clientIp,
    env.REFRESH_TOKEN_EXPIRES_IN
  );

  return {
    data: {
      redirectUrl: `${env.FRONTEND_URL}/login?oauth_success=true${redirectParam}`,
      refreshToken,
    },
  };
};

/** Kakao OAuth 콜백을 처리한다. */
export const processKakaoCallbackService = async (
  profile: any,
  stateParam: unknown,
  deviceInfo: OAuthDeviceInfo
): Promise<OAuthCallbackResult> => {
  let stateData: { deviceId: unknown; redirect?: string };
  try {
    stateData = await verifyOAuthState(stateParam);
  } catch (error) {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=kakao_login_failed`,
      },
    };
  }

  const { deviceId, redirect } = stateData;
  const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));

  if (!deviceId || typeof deviceId !== "string") {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`,
      },
    };
  }

  if (!profile || !profile.id || profile.provider !== "kakao") {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`,
      },
    };
  }

  const provider = AUTH_PROVIDERS.KAKAO;
  const providerId = String(profile.id);

  let user = await findOrCreateOAuthUser(provider, providerId, undefined, false);

  if (!user || user.deleted_at) {
    return {
      error: {
        redirectUrl: `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`,
      },
    };
  }

  const refreshToken = generateRefreshToken();

  await saveRefreshToken(
    user.id,
    deviceId,
    refreshToken,
    deviceInfo.userAgent,
    deviceInfo.clientIp,
    env.REFRESH_TOKEN_EXPIRES_IN
  );

  return {
    data: {
      redirectUrl: `${env.FRONTEND_URL}/login?oauth_success=true${redirectParam}`,
      refreshToken,
    },
  };
};

/**
 * OAuth 사용자를 조회하거나 생성한다.
 *
 * @param mergeByEmail - 이메일 기반 계정 통합 여부 (Google만 true)
 */
const findOrCreateOAuthUser = async (
  provider: AuthProvider,
  providerId: string,
  email: string | undefined,
  mergeByEmail: boolean
) => {
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

  // email 기반 통합: 일반 회원가입 사용자에 provider 정보를 추가한다
  if (!user && email && mergeByEmail) {
    user = await prisma.user.findUnique({
      where: { email, deleted_at: null },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
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

  // nick 충돌 시 재시도
  if (!user) {
    const MAX_RETRY = 3;
    for (let i = 0; i < MAX_RETRY; i++) {
      try {
        user = await prisma.user.create({
          data: {
            ...(email && mergeByEmail ? { email } : {}),
            nick: generateNick(),
            ...(email && mergeByEmail ? { email_verified_at: new Date() } : {}),
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

  return user;
};
