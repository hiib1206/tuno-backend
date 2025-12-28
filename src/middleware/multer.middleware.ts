import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { sendError } from "../utils/commonResponse";
import {
  allowedPostImageFileSize,
  allowedPostImageMimeTypes,
  allowedProfileImageFileSize,
  allowedProfileImageMimeTypes,
  maxPostImagesCount,
  uploadPostImageMulter,
  uploadProfileImageMulter,
} from "../utils/multer";

// 에러 처리를 포함한 프로필 이미지 업로드 미들웨어
export const uploadProfileImageMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    uploadProfileImageMulter(req, res, (err) => {
      if (err) {
        // MulterError 처리
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return sendError(
              res,
              400,
              `파일 크기는 ${
                allowedProfileImageFileSize / 1024 / 1024
              }MB 이하여야 합니다.`
            );
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            return sendError(res, 400, "파일은 1개만 업로드 가능합니다.");
          }
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return sendError(res, 400, `올바른 필드명을 사용해주세요.`);
          }
          // 커스텀
          if (err.code === ("INVALID_FILE_TYPE" as multer.ErrorCode)) {
            err.message = `${allowedProfileImageMimeTypes
              .map((type: string) => type.replace("image/", ""))
              .join(", ")} 형식의 이미지만 업로드 가능합니다.`;
            return sendError(res, 400, err.message);
          }
        }

        return next(err);
      }

      // 에러가 없으면 다음 미들웨어로 진행
      next();
    });
  } catch (error) {
    next(error);
  }
};

// 에러 처리를 포함한 게시글 이미지 업로드 미들웨어
export const uploadPostImageMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    uploadPostImageMulter(req, res, (err) => {
      if (err) {
        // MulterError 처리
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return sendError(
              res,
              400,
              `파일 크기는 ${
                allowedPostImageFileSize / 1024 / 1024
              }MB 이하여야 합니다.`
            );
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            return sendError(
              res,
              400,
              `이미지는 최대 ${maxPostImagesCount}개까지 업로드 가능합니다.`
            );
          }
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return sendError(res, 400, `올바른 필드명을 사용해주세요.`);
          }
          // 커스텀
          if (err.code === ("INVALID_FILE_TYPE" as multer.ErrorCode)) {
            err.message = `${allowedPostImageMimeTypes
              .map((type: string) => type.replace("image/", ""))
              .join(", ")} 형식의 이미지만 업로드 가능합니다.`;
            return sendError(res, 400, err.message);
          }
        }

        return next(err);
      }

      // 에러가 없으면 다음 미들웨어로 진행
      next();
    });
  } catch (error) {
    next(error);
  }
};
