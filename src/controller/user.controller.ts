import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { env } from "../config/env";
import { firebaseStorage } from "../config/firebase";
import prisma from "../config/prisma";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "../utils/email";
import { sendError, sendSuccess } from "../utils/response";
import { toUserResponse } from "../utils/user";

// me
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.user!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user?.is_active) {
      return sendError(res, 400, "사용자를 찾을 수 없습니다.");
    }

    return sendSuccess(res, 200, "내 정보를 조회했습니다.", {
      user: toUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// 아이디 중복 체크
export const checkUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username } = req.query;
    if (!username) {
      return sendError(res, 400, "아이디를 입력해주세요.");
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username: username as string },
    });

    if (existingUsername) {
      return sendError(res, 400, "사용 불가능한 아이디입니다.");
    }

    return sendSuccess(res, 200, "아이디 중복 체크 완료.");
  } catch (error) {
    next(error);
  }
};

// 닉네임 중복 체크
export const checkNickname = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { nick } = req.query;

    if (!nick) {
      return sendError(res, 400, "닉네임을 입력해주세요.");
    }

    const existingNick = await prisma.user.findUnique({
      where: { nick: nick as string },
    });

    if (existingNick) {
      return sendError(res, 400, "사용 불가능한 닉네임입니다.");
    }

    return sendSuccess(res, 200, "닉네임 중복 체크 완료.");
  } catch (error) {
    next(error);
  }
};

// 닉네임 변경
export const changeNickname = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user!;
    const { nick } = req.body;

    if (!nick) {
      return sendError(res, 400, "닉네임을 입력해주세요.");
    }

    const existingNick = await prisma.user.findUnique({
      where: { nick: nick as string },
    });

    if (existingNick) {
      return sendError(res, 400, "사용 불가능한 닉네임입니다.");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { nick },
    });

    return sendSuccess(res, 200, "닉네임이 변경되었습니다.", {
      user: toUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// 프로필 이미지 업로드
export const uploadProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user!;
    const file = req.file;

    if (!file) {
      return sendError(res, 400, "파일이 존재하지 않습니다.");
    }

    // 기존 사용자 정보 조회
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { profile_image_url: true },
    });

    let fileName: string;

    const ext = path.extname(file.originalname); // ".png"
    if (currentUser?.profile_image_url) {
      // 기존 프로필 이미지가 있으면 같은 파일명 사용 (확장자만 업데이트)
      const existingExt = path.extname(currentUser.profile_image_url); // ".png"
      fileName = currentUser.profile_image_url.replace(existingExt, ext); // 확장자만 교체
    } else {
      // 기존 프로필 이미지가 없으면 새로 생성
      const uuid = randomUUID();
      fileName = `profile-image/${userId}/${uuid}${ext}`; // "profile-image/1/uuid.png"
    }

    // Firebase Storage 파일 참조 생성
    const fileRef = firebaseStorage.file(fileName);

    // 파일 업로드 (기존 파일이 있으면 덮어쓰기)
    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
      public: true,
    });

    // 공개 URL 생성 : https://storage.googleapis.com/[bucket-name]/profile-image/[userId]/[uuid].[ext]
    // const imageUrl = fileRef.publicUrl();

    // DB에 프로필 이미지 URL 저장
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        profile_image_url: fileName,
        profile_image_updated_at: new Date(),
      },
    });

    return sendSuccess(res, 200, "프로필 이미지가 업로드되었습니다.", {
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
    await prisma.email_verification_code.deleteMany({
      where: { user_id: userId },
    });

    // 6자리 코드 생성
    const code = generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + Number(env.SENDGRID_EXPIRES_IN) * 60 * 1000
    ); // SENDGRID_EXPIRES_IN(분) 후 만료

    await sendVerificationEmail(email, code);

    // DB에 저장
    const verificationRecord = await prisma.email_verification_code.create({
      data: {
        user_id: userId,
        new_email: email,
        code,
        expires_at: expiresAt,
      },
    });

    return sendSuccess(res, 200, "인증 코드가 이메일로 발송되었습니다.", {
      expiresAt: verificationRecord.expires_at.toISOString(),
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
    const verification = await prisma.email_verification_code.findFirst({
      where: {
        user_id: userId,
        new_email: email,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!verification) {
      return sendError(res, 400, "유효하지 않은 인증 코드입니다.");
    }

    // 만료 시간 확인
    if (verification.expires_at < new Date()) {
      await prisma.email_verification_code.delete({
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
      await prisma.email_verification_code.delete({
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
      const updatedVerification = await prisma.email_verification_code.update({
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
          email_verified_at: new Date(),
        },
      }),
      prisma.email_verification_code.delete({
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
    await prisma.email_verification_code.deleteMany({
      where: { user_id: userId },
    });

    // 새 코드 생성 및 발송 (requestEmailVerification과 동일한 로직)
    const code = generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + Number(env.SENDGRID_EXPIRES_IN) * 60 * 1000
    ); // SENDGRID_EXPIRES_IN(분) 후 만료

    await sendVerificationEmail(email, code);

    const verificationRecord = await prisma.email_verification_code.create({
      data: {
        user_id: userId,
        new_email: email,
        code,
        expires_at: expiresAt,
      },
    });

    return sendSuccess(res, 200, "인증 코드가 재발송되었습니다.", {
      expiresAt: verificationRecord.expires_at.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

// 비밀번호 변경 로직
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user!;
    const { oldPw, newPw } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user?.is_active) {
      return sendError(res, 400, "사용자를 찾을 수 없습니다.");
    }

    const isPasswordValid = await bcrypt.compare(oldPw, user.pw);
    if (!isPasswordValid) {
      return sendError(res, 400, "비밀번호가 일치하지 않습니다.");
    }

    const hashedNewPw = await bcrypt.hash(newPw, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { pw: hashedNewPw },
    });

    return sendSuccess(res, 200, "비밀번호가 변경되었습니다.");
  } catch (error) {
    next(error);
  }
};
