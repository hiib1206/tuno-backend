import { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/response";
import prisma from "../config/prisma";

export const updateUser = async (req: Request, res: Response) => {
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

    return sendSuccess(res, 200, "유저 정보를 수정했습니다.", { user });
  } catch (error) {
    return sendError(res, 500, "유저 정보 수정 중 에러가 발생했습니다.");
  }
};

// 아이디 중복 체크
export const checkUsername = async (req: Request, res: Response) => {
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
    return sendError(res, 500, "아이디 중복 체크 중 에러가 발생했습니다.");
  }
};

// 닉네임 중복 체크
export const checkNickname = async (req: Request, res: Response) => {
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
    return sendError(res, 500, "닉네임 중복 체크 중 에러가 발생했습니다.");
  }
};
