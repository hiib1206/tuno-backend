import prisma from "../config/prisma";
import { sendError, sendSuccess } from "../utils/response";
import { Request, Response } from "express";

// access token 검증 테스트
export const testAccessToken = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    return sendSuccess(res, 200, "access token 검증 테스트가 완료되었습니다.", {
      userId,
    });
  } catch (error) {
    return sendError(
      res,
      500,
      "access token 검증 테스트 중 에러가 발생했습니다."
    );
  }
};

// 응답 Test
export const testResponse = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: {
      id: 3,
    },
  });
  return sendSuccess(res, 200, "응답 테스트가 완료되었습니다.", {
    user,
  });
};
