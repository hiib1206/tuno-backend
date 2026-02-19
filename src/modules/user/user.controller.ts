import { Request, Response } from "express";
import { BadRequestError } from "../../shared/errors/AppError";
import { sendSuccess } from "../../shared/utils/commonResponse";
import { UserPayload } from "../../shared/utils/token";
import {
  changeNicknameService,
  changePasswordService,
  checkNicknameService,
  checkUsernameService,
  getMeService,
  getUserCommunityStatsService,
  resendEmailVerificationService,
  sendEmailVerificationService,
  uploadProfileImageService,
  verifyEmailService,
  withdrawUserService,
} from "./user.service";

/** 내 정보를 조회한다. */
export const me = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const result = await getMeService(userId);

  return sendSuccess(res, 200, "내 정보를 조회했습니다.", result.data);
};

/** 아이디 중복 여부를 확인한다. */
export const checkUsername = async (req: Request, res: Response) => {
  const { username } = req.query;
  if (!username) {
    throw new BadRequestError("아이디를 입력해주세요.");
  }

  await checkUsernameService(username as string);

  return sendSuccess(res, 200, "아이디 중복 체크 완료.");
};

/** 닉네임 중복 여부를 확인한다. */
export const checkNickname = async (req: Request, res: Response) => {
  const { nick } = req.query;

  if (!nick) {
    throw new BadRequestError("닉네임을 입력해주세요.");
  }

  await checkNicknameService(nick as string);

  return sendSuccess(res, 200, "닉네임 중복 체크 완료.");
};

/** 닉네임을 변경한다. */
export const changeNickname = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { nick } = req.validated?.body;

  const result = await changeNicknameService(userId, nick);

  return sendSuccess(res, 200, "닉네임이 변경되었습니다.", result.data);
};

/** 프로필 이미지를 업로드한다. */
export const uploadProfileImage = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const file = req.file;

  if (!file) {
    throw new BadRequestError("파일이 존재하지 않습니다.");
  }

  const result = await uploadProfileImageService(userId, {
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
  });

  return sendSuccess(res, 200, "프로필 이미지가 업로드되었습니다.", result.data);
};

/** 이메일 인증 코드를 발송한다. */
export const sendEmailVerification = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { email } = req.validated?.body;

  await sendEmailVerificationService(userId, email);

  return sendSuccess(res, 200, "인증 코드가 이메일로 발송되었습니다.");
};

/** 이메일 인증 코드를 재발송한다. */
export const resendEmailVerification = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { email } = req.validated?.body;

  await resendEmailVerificationService(userId, email);

  return sendSuccess(res, 200, "인증 코드가 재전송되었습니다.");
};

/** 이메일 인증 코드를 검증한다. */
export const verifyEmail = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { code } = req.validated?.body;

  await verifyEmailService(userId, code);

  return sendSuccess(res, 200, "이메일 인증이 완료되었습니다.");
};

/** 비밀번호를 변경한다. */
export const changePassword = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { oldPw, newPw } = req.validated?.body;

  await changePasswordService(userId, oldPw, newPw);

  return sendSuccess(res, 200, "비밀번호가 변경되었습니다.");
};

/** 커뮤니티 활동 통계를 조회한다. */
export const getUserCommunityStats = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;

  const result = await getUserCommunityStatsService(userId);

  return sendSuccess(res, 200, "커뮤니티 통계를 조회했습니다.", result.data);
};

/** 회원탈퇴를 처리한다. */
export const withdrawUser = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;

  await withdrawUserService(userId);

  return sendSuccess(res, 200, "회원탈퇴가 완료되었습니다.");
};
