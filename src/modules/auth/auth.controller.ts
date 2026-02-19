import { NextFunction, Request, Response } from "express";
import type { Profile as GoogleProfile } from "passport-google-oauth20";
import { env } from "../../config/env";
import passport from "../../config/passport";
import { BadRequestError } from "../../shared/errors/AppError";
import { sendSuccess } from "../../shared/utils/commonResponse";
import { getClientIp, getDeviceId, getUserAgent } from "../../shared/utils/request";
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
  UserPayload,
} from "../../shared/utils/token";
import {
  EmailVerificationSchema,
  FindUsernameSchema,
  PasswordResetRequestSchema,
  PasswordResetSchema,
  RegisterSchema,
  VerifyEmailSchema,
} from "./auth.schema";
import {
  findUsernameService,
  loginService,
  logoutService,
  processGoogleCallbackService,
  processKakaoCallbackService,
  processNaverCallbackService,
  refreshService,
  registerService,
  requestPasswordResetService,
  resendEmailVerificationService,
  resetPasswordService,
  sendEmailVerificationService,
  verifyEmailService,
} from "./auth.service";
import {
  buildRedirectParam,
  generateOAuthState,
  sanitizeRedirect,
  uuidRegex,
} from "./auth.utils";

/** 이메일 인증 코드를 발송한다. */
export const sendEmailVerification = async (req: Request, res: Response) => {
  const { email } = req.validated?.body as EmailVerificationSchema;

  await sendEmailVerificationService(email);

  return sendSuccess(res, 200, "인증 코드가 이메일로 발송되었습니다.");
};

/** 이메일 인증 코드를 재발송한다. */
export const resendEmailVerification = async (req: Request, res: Response) => {
  const { email } = req.validated?.body as EmailVerificationSchema;

  await resendEmailVerificationService(email);

  return sendSuccess(res, 200, "인증 코드가 재전송되었습니다.");
};

/** 이메일 인증 코드를 검증한다. */
export const verifyEmail = async (req: Request, res: Response) => {
  const { email, code } = req.validated?.body as VerifyEmailSchema;

  const result = await verifyEmailService(email, code);

  if (result.data?.alreadyVerified) {
    return sendSuccess(res, 200, "이미 인증이 완료되었습니다.", {
      signupToken: result.data.signupToken,
    });
  }

  return sendSuccess(res, 200, "이메일 인증이 완료되었습니다.", {
    signupToken: result.data?.signupToken,
  });
};

/** 회원가입을 처리한다. */
export const register = async (req: Request, res: Response) => {
  const data = req.validated?.body as RegisterSchema;

  await registerService(data);

  return sendSuccess(res, 201, "회원가입이 완료되었습니다.");
};

/** 로그인을 처리한다. */
export const login = async (req: Request, res: Response) => {
  const { username, pw } = req.body;
  const deviceId = getDeviceId(req);

  if (!deviceId) {
    throw new BadRequestError("x-device-id 헤더가 필요합니다.");
  }

  const deviceInfo = {
    deviceId,
    userAgent: getUserAgent(req),
    clientIp: getClientIp(req),
  };

  const result = await loginService(username, pw, deviceInfo);

  setRefreshTokenCookie(res, result.data!.refreshToken);

  return sendSuccess(res, 200, "로그인이 완료되었습니다.", {
    accessToken: result.data!.accessToken,
    user: result.data!.user,
  });
};

/** 토큰을 갱신한다. */
export const refresh = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const oldRefreshToken = req.refreshToken;
  const oldDeviceId = req.deviceId;
  const deviceId = getDeviceId(req);

  if (!deviceId) {
    throw new BadRequestError("x-device-id 헤더가 필요합니다.");
  }

  const deviceInfo = {
    deviceId,
    userAgent: getUserAgent(req),
    clientIp: getClientIp(req),
  };

  const result = await refreshService(userId, oldDeviceId, oldRefreshToken, deviceInfo);

  setRefreshTokenCookie(res, result.data!.refreshToken);

  return sendSuccess(res, 200, "토큰 갱신이 완료되었습니다.", {
    accessToken: result.data!.accessToken,
  });
};

/** 로그아웃을 처리한다. */
export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  await logoutService(refreshToken);

  clearRefreshTokenCookie(res);
  return sendSuccess(res, 200, "로그아웃이 완료되었습니다.");
};

/** Google OAuth를 시작한다. */
export const google = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceId, redirect } = req.query as any;

    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
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
    } as any)(req, res, () => {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`
      );
    });
  } catch {
    const redirect = req.query.redirect as string | undefined;
    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    return res.redirect(
      `${env.FRONTEND_URL}/login?error=google_login_failed${redirectParam}`
    );
  }
};

/** Naver OAuth를 시작한다. */
export const naver = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceId, redirect } = req.query as any;

    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    if (!deviceId || !uuidRegex.test(deviceId)) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`
      );
    }

    const state = await generateOAuthState(deviceId, redirect);

    passport.authenticate("naver", {
      session: false,
      state,
    } as any)(req, res, () => {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`
      );
    });
  } catch {
    const redirect = req.query.redirect as string | undefined;
    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    return res.redirect(
      `${env.FRONTEND_URL}/login?error=naver_login_failed${redirectParam}`
    );
  }
};

/** Kakao OAuth를 시작한다. */
export const kakao = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceId, redirect } = req.query as any;

    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    if (!deviceId || !uuidRegex.test(deviceId)) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`
      );
    }

    const state = await generateOAuthState(deviceId, redirect);

    passport.authenticate("kakao", {
      session: false,
      state,
    } as any)(req, res, () => {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`
      );
    });
  } catch {
    const redirect = req.query.redirect as string | undefined;
    const redirectParam = buildRedirectParam(sanitizeRedirect(redirect));
    return res.redirect(
      `${env.FRONTEND_URL}/login?error=kakao_login_failed${redirectParam}`
    );
  }
};

/** Google OAuth 콜백을 처리한다. */
export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = req.user as GoogleProfile;
    const deviceInfo = {
      userAgent: getUserAgent(req),
      clientIp: getClientIp(req),
    };

    const result = await processGoogleCallbackService(
      profile,
      req.query.state,
      deviceInfo
    );

    if (result.error) {
      return res.redirect(result.error.redirectUrl);
    }

    setRefreshTokenCookie(res, result.data!.refreshToken);
    return res.redirect(result.data!.redirectUrl);
  } catch {
    return res.redirect(`${env.FRONTEND_URL}/login?error=google_login_failed`);
  }
};

/** Naver OAuth 콜백을 처리한다. */
export const naverCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = req.user as any;
    const deviceInfo = {
      userAgent: getUserAgent(req),
      clientIp: getClientIp(req),
    };

    const result = await processNaverCallbackService(
      profile,
      req.query.state,
      deviceInfo
    );

    if (result.error) {
      return res.redirect(result.error.redirectUrl);
    }

    setRefreshTokenCookie(res, result.data!.refreshToken);
    return res.redirect(result.data!.redirectUrl);
  } catch {
    return res.redirect(`${env.FRONTEND_URL}/login?error=naver_login_failed`);
  }
};

/** Kakao OAuth 콜백을 처리한다. */
export const kakaoCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = req.user as any;
    const deviceInfo = {
      userAgent: getUserAgent(req),
      clientIp: getClientIp(req),
    };

    const result = await processKakaoCallbackService(
      profile,
      req.query.state,
      deviceInfo
    );

    if (result.error) {
      return res.redirect(result.error.redirectUrl);
    }

    setRefreshTokenCookie(res, result.data!.refreshToken);
    return res.redirect(result.data!.redirectUrl);
  } catch {
    return res.redirect(`${env.FRONTEND_URL}/login?error=kakao_login_failed`);
  }
};

/** 아이디 찾기를 처리한다. */
export const findUsername = async (req: Request, res: Response) => {
  const { email } = req.validated?.body as FindUsernameSchema;

  await findUsernameService(email);

  return sendSuccess(res, 200, "이메일이 발송되었습니다.");
};

/** 비밀번호 재설정 요청을 처리한다. */
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { username, email } = req.validated?.body as PasswordResetRequestSchema;

  await requestPasswordResetService(username, email);

  return sendSuccess(res, 200, "이메일이 발송되었습니다.");
};

/** 비밀번호를 재설정한다. */
export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPw } = req.validated?.body as PasswordResetSchema;

  await resetPasswordService(token, newPw);

  return sendSuccess(res, 200, "비밀번호가 성공적으로 변경되었습니다.");
};
