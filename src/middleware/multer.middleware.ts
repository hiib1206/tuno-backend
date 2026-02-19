import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { BadRequestError } from "../shared/errors/AppError";
import {
  allowedPostImageFileSize,
  allowedPostImageMimeTypes,
  allowedProfileImageFileSize,
  allowedProfileImageMimeTypes,
  maxPostImagesCount,
  uploadPostImageMulter,
  uploadProfileImageMulter,
} from "../shared/utils/multer";

/**
 * 프로필 이미지 업로드 미들웨어.
 *
 * @remarks
 * MulterError를 사용자 친화적 메시지로 변환한다.
 *
 * @throws {@link BadRequestError} 파일 크기, 개수, 형식 제한 위반 시
 */
export const uploadProfileImageMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  uploadProfileImageMulter(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new BadRequestError(
              `파일 크기는 ${
                allowedProfileImageFileSize / 1024 / 1024
              }MB 이하여야 합니다.`
            )
          );
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return next(new BadRequestError("파일은 1개만 업로드 가능합니다."));
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(new BadRequestError(`올바른 필드명을 사용해주세요.`));
        }
        // Multer fileFilter에서 던진 커스텀 에러 코드
        if (err.code === ("INVALID_FILE_TYPE" as multer.ErrorCode)) {
          return next(
            new BadRequestError(
              `${allowedProfileImageMimeTypes
                .map((type: string) => type.replace("image/", ""))
                .join(", ")} 형식의 이미지만 업로드 가능합니다.`
            )
          );
        }
      }

      return next(err);
    }

    next();
  });
};

/**
 * 게시글 이미지 업로드 미들웨어.
 *
 * @remarks
 * MulterError를 사용자 친화적 메시지로 변환한다.
 *
 * @throws {@link BadRequestError} 파일 크기, 개수, 형식 제한 위반 시
 */
export const uploadPostImageMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  uploadPostImageMulter(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new BadRequestError(
              `파일 크기는 ${
                allowedPostImageFileSize / 1024 / 1024
              }MB 이하여야 합니다.`
            )
          );
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return next(
            new BadRequestError(
              `이미지는 최대 ${maxPostImagesCount}개까지 업로드 가능합니다.`
            )
          );
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(new BadRequestError(`올바른 필드명을 사용해주세요.`));
        }
        // Multer fileFilter에서 던진 커스텀 에러 코드
        if (err.code === ("INVALID_FILE_TYPE" as multer.ErrorCode)) {
          return next(
            new BadRequestError(
              `${allowedPostImageMimeTypes
                .map((type: string) => type.replace("image/", ""))
                .join(", ")} 형식의 이미지만 업로드 가능합니다.`
            )
          );
        }
      }

      return next(err);
    }

    next();
  });
};
