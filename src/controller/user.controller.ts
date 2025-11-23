import { NextFunction, Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/response";
import prisma from "../config/prisma";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { firebaseStorage } from "../config/firebase";
import { toUserResponse } from "../utils/user";

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user!;
    const { nick, email, phone } = req.body;

    if (email) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (currentUser && currentUser.email !== email) {
        await prisma.user.update({
          where: { id: userId },
          data: { email: null, emailVerifiedAt: null },
        });
        return sendError(res, 400, "해당 이메일로 인증이 완료되지 않았습니다.");
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { nick, email, phone },
    });

    return sendSuccess(res, 200, "유저 정보를 수정했습니다.", {
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
      select: { profileImageUrl: true },
    });

    let fileName: string;

    const ext = path.extname(file.originalname); // ".png"
    if (currentUser?.profileImageUrl) {
      // 기존 프로필 이미지가 있으면 같은 파일명 사용 (확장자만 업데이트)
      const existingExt = path.extname(currentUser.profileImageUrl); // ".png"
      fileName = currentUser.profileImageUrl.replace(existingExt, ext); // 확장자만 교체
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
      data: { profileImageUrl: fileName },
    });

    return sendSuccess(res, 200, "프로필 이미지가 업로드되었습니다.", {
      user: toUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};
