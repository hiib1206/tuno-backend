import prisma from "../config/prisma";
import { sendError, sendSuccess } from "../utils/response";
import { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";

// access token 검증 테스트
export const testAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user!;
    return sendSuccess(res, 200, "access token 검증 테스트가 완료되었습니다.", {
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// 응답 Test
export const testResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: 3,
      },
    });
    return sendSuccess(res, 200, "응답 테스트가 완료되었습니다.", {
      user,
    });
  } catch (error) {
    next(error);
  }
};

// 파일 업로드 테스트
export const testFileUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const file = req.file;

    if (!file) {
      return sendError(res, 400, "파일이 업로드되지 않았습니다.");
    }

    // 업로드 디렉토리 경로 설정 (프로젝트 루트/uploads)
    const uploadDir = path.join(process.cwd(), "uploads");

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 파일명 생성 (타임스탬프_원본파일명)
    const timestamp = Date.now();
    const originalName = file.originalname;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const fileName = `${timestamp}_${baseName}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // 파일 저장
    fs.writeFileSync(filePath, file.buffer);

    return sendSuccess(res, 200, "파일 업로드 및 저장이 완료되었습니다.", {
      file: {
        fieldname: file.fieldname,
        originalname: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype,
        size: file.size,
        savedPath: filePath,
        savedFileName: fileName,
        url: `/uploads/${fileName}`, // 정적 파일 서빙을 위한 URL
      },
    });
  } catch (error) {
    next(error);
  }
};
