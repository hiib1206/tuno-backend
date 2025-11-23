import multer from "multer";

// 프로필 이미지에서서 허용할 이미지 MIME 타입
export const allowedProfileImageMimeTypes = [
  "image/jpeg", // jpg, jpeg 포함임
  "image/png",
  "image/webp",
];

export const fieldName = "profileImage";

// 프로필 이미지에서 허용할 이미지 크기
export const allowedProfileImageFileSize = 3 * 1024 * 1024; // 3MB

// 프로필 이미지에서 허용할 이미지 파일 필터
const profileImageFileFilter = (
  req: Express.Request,
  file: Express.Multer.File, // ← 파일 정보가 들어있음
  cb: multer.FileFilterCallback // ← multer의 콜백 함수
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

// 프로필 이미지 업로드 설정
const uploadProfileImager = multer({
  storage: multer.memoryStorage(), //서버 ram에 버퍼로 저장
  limits: {
    fileSize: allowedProfileImageFileSize, // 1MB 제한
  },
  // multer가 파일을 받을 때 호출 됨
  fileFilter: profileImageFileFilter,
});

// 프로필 이미지 전용 미들웨어 (단일 파일)
export const uploadProfileImageMulter = uploadProfileImager.single(fieldName);
