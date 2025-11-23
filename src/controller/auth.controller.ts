import { NextFunction, Request, Response } from "express";
import prisma from "../config/prisma";
import { sendError, sendSuccess } from "../utils/response";
import bcrypt from "bcrypt";
import { env } from "../config/env";
import {
  generateAccessToken,
  generateRefreshToken,
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from "../utils/jwt";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "../utils/email";
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

    const user = await prisma.user.create({
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

// me
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.user!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return sendError(res, 404, "사용자를 찾을 수 없습니다.");
    }

    return sendSuccess(res, 200, "내 정보를 조회했습니다.", {
      user: toUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// 이메일 인증 코드 요청
export const requestEmailVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user!;
    const { email } = req.body;

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.id !== userId) {
      return sendError(res, 400, "이미 사용 중인 이메일입니다.");
    }

    // 기존 인증 코드가 있으면 삭제
    await prisma.emailVerificationCode.deleteMany({
      where: { userId },
    });

    // 6자리 코드 생성
    const code = generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + Number(env.SENDGRID_EXPIRES_IN) * 60 * 1000
    ); // SENDGRID_EXPIRES_IN(분) 후 만료

    await sendVerificationEmail(email, code);

    // DB에 저장
    const verificationRecord = await prisma.emailVerificationCode.create({
      data: {
        userId,
        newEmail: email,
        code,
        expiresAt,
      },
    });

    return sendSuccess(res, 200, "인증 코드가 이메일로 발송되었습니다.", {
      expiresAt: verificationRecord.expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

// 인증 코드 확인
export const verifyEmailCode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user!;
    const { email, code } = req.body;

    // 인증 코드 조회 (userId와 email로만 조회, code는 나중에 확인)
    const verification = await prisma.emailVerificationCode.findFirst({
      where: {
        userId,
        newEmail: email,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!verification) {
      return sendError(res, 400, "유효하지 않은 인증 코드입니다.");
    }

    // 만료 시간 확인
    if (verification.expiresAt < new Date()) {
      await prisma.emailVerificationCode.delete({
        where: { id: verification.id },
      });
      return sendError(
        res,
        400,
        "입력시간이 초과 되었습니다. 재발송을 눌러주세요."
      );
    }

    // 시도 횟수 확인 (최대 5회)
    if (verification.attempts >= 5) {
      await prisma.emailVerificationCode.delete({
        where: { id: verification.id },
      });
      return sendError(
        res,
        400,
        "인증 코드 시도 횟수를 초과했습니다. 재발송을 눌러주세요."
      );
    }

    // 코드 일치 확인
    if (verification.code !== code) {
      // 시도 횟수 증가
      const updatedVerification = await prisma.emailVerificationCode.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      return sendError(
        res,
        400,
        `인증 코드가 일치하지 않습니다. 시도 횟수 : ${updatedVerification.attempts}회 (최대 5회)`
      );
    }

    // 성공: emailVerifiedAt 업데이트 및 인증 레코드 삭제
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          email: email,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.emailVerificationCode.delete({
        where: { id: verification.id },
      }),
    ]);

    return sendSuccess(res, 200, "이메일 인증이 완료되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 인증 코드 재발송
export const resendEmailVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user!;
    const { email } = req.body;

    // 기존 코드 삭제
    await prisma.emailVerificationCode.deleteMany({
      where: { userId },
    });

    // 새 코드 생성 및 발송 (requestEmailVerification과 동일한 로직)
    const code = generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + Number(env.SENDGRID_EXPIRES_IN) * 60 * 1000
    ); // SENDGRID_EXPIRES_IN(분) 후 만료

    await sendVerificationEmail(email, code);

    const verificationRecord = await prisma.emailVerificationCode.create({
      data: {
        userId,
        newEmail: email,
        code,
        expiresAt,
      },
    });

    return sendSuccess(res, 200, "인증 코드가 재발송되었습니다.", {
      expiresAt: verificationRecord.expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
