import multer from "multer";

/** 프로필 이미지에서 허용할 MIME 타입 목록. */
export const allowedProfileImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** 프로필 이미지 필드명. */
export const fieldName = "profileImage";

/** 프로필 이미지 최대 파일 크기 (3MB). */
export const allowedProfileImageFileSize = 3 * 1024 * 1024;

const profileImageFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (allowedProfileImageMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new multer.MulterError(
      "INVALID_FILE_TYPE" as multer.ErrorCode
    );
    cb(error);
  }
};

const uploadProfileImager = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: allowedProfileImageFileSize,
  },
  fileFilter: profileImageFileFilter,
});

/** 프로필 이미지 단일 파일 업로드 미들웨어. */
export const uploadProfileImageMulter = uploadProfileImager.single(fieldName);

/** 게시글 이미지에서 허용할 MIME 타입 목록. */
export const allowedPostImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/** 게시글 이미지 최대 파일 크기 (10MB). */
export const allowedPostImageFileSize = 10 * 1024 * 1024;

/** 게시글 이미지 최대 개수. */
export const maxPostImagesCount = 10;

/** 게시글 이미지 필드명. */
export const postImagesFieldName = "images";

const postImageFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (allowedPostImageMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new multer.MulterError(
      "INVALID_FILE_TYPE" as multer.ErrorCode
    );
    cb(error);
  }
};

const uploadPostImager = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: allowedPostImageFileSize,
  },
  fileFilter: postImageFileFilter,
});

/** 게시글 이미지 다중 파일 업로드 미들웨어. */
export const uploadPostImageMulter = uploadPostImager.array(
  postImagesFieldName,
  maxPostImagesCount
);
