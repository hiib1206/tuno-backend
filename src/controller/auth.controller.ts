import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import prisma from "../config/prisma";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "../utils/email";
import {
  clearRefreshTokenCookie,
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
} from "../utils/jwt";
import { sendError, sendSuccess } from "../utils/response";
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
    const refreshToken = generateRefreshToken(user.id);

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
    const { userId } = req.user!;

    const accessToken = generateAccessToken(userId);
    const refreshToken = generateRefreshToken(userId);

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
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    clearRefreshTokenCookie(res);
    return sendSuccess(res, 200, "로그아웃이 완료되었습니다.");
  } catch (error) {
    next(error);
  }
};
