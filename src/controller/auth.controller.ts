import bcrypt from "bcrypt";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import type { Profile } from "passport-google-oauth20";
import { env } from "../config/env";
import passport from "../config/passport";
import prisma from "../config/prisma";
import { getClientIp, getDeviceId, getUserAgent } from "../utils/request";
import { sendError, sendSuccess } from "../utils/response";
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
export const google = (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceId = req.query.deviceId;

    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
      state: deviceId,
    } as any)(req, res, (err: any) => {
      // passport.authenticate의 에러는 여기서 처리
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=google_login_failed`
      );
    });
  } catch (error) {
    // 에러 발생 시 프론트엔드로 리다이렉트
    return res.redirect(`${env.FRONTEND_URL}/login?error=google_login_failed`);
  }
};

// Google OAuth 콜백 처리
export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = req.user as Profile;

    if (!profile || !profile.emails || !profile.emails[0]) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=google_login_failed`
      );
    }

    const email = profile.emails[0].value;
    const displayName = profile.displayName || email.split("@")[0];

    // email로 기존 사용자 찾기
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // 사용자가 없으면 새로 생성
    if (!user) {
      // Google 로그인 사용자는 pw가 필요 없으므로 랜덤 해시 생성
      const randomPw = await bcrypt.hash(
        `google_${Date.now()}_${Math.random()}`,
        10
      );

      // username과 nick은 중복 방지를 위해 랜덤 문자열 추가
      // 예) username_a4f3, nick_a4f3
      const base = email.split("@")[0];
      const shortId = crypto.randomBytes(2).toString("hex");
      const username = `${base}_${shortId}`;
      const nick = `${displayName}_${shortId}`;

      user = await prisma.user.create({
        data: {
          username,
          email,
          pw: randomPw,
          nick,
          email_verified_at: new Date(), // Google 로그인은 이메일이 이미 인증됨
        },
      });
    }

    // JWT 토큰 생성 및 저장
    const refreshToken = generateRefreshToken();
    // state에서 deviceId 추출 (Google OAuth 콜백은 브라우저 리다이렉트이므로 헤더가 없음)
    const deviceId = req.query.state as string;

    if (!deviceId) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=device_id_required`);
    }

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
    return res.redirect(`${env.FRONTEND_URL}/login?oauth_success=true`);
  } catch (error) {
    // 실패 시 프론트엔드로 리다이렉트
    return res.redirect(`${env.FRONTEND_URL}/login?error=google_login_failed`);
  }
};
