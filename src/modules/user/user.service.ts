import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { firebaseStorage } from "../../config/firebase";
import logger from "../../config/logger";
import prisma from "../../config/prisma";
import redis from "../../config/redis";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../shared/errors/AppError";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "../../shared/utils/email";
import { deleteAllRefreshTokens } from "../../shared/utils/token";
import { toUserResponse } from "./user.utils";

/** Multer 파일에서 추출한 데이터. */
interface FileData {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/** 내 정보를 조회한다. */
export const getMeService = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { auth_providers: true },
  });

  if (!user || user.deleted_at) {
    throw new UnauthorizedError("사용자를 찾을 수 없습니다.");
  }

  return { data: { user: toUserResponse(user) } };
};

/** 아이디 중복 여부를 확인한다. */
export const checkUsernameService = async (username: string) => {
  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUsername) {
    throw new BadRequestError("사용 불가능한 아이디입니다.");
  }

  return { data: null };
};

/** 닉네임 중복 여부를 확인한다. */
export const checkNicknameService = async (nick: string) => {
  const existingNick = await prisma.user.findUnique({
    where: { nick },
  });

  if (existingNick) {
    throw new BadRequestError("사용 불가능한 닉네임입니다.");
  }

  return { data: null };
};

/** 닉네임을 변경한다. */
export const changeNicknameService = async (userId: number, nick: string) => {
  const existingNick = await prisma.user.findUnique({
    where: { nick },
  });

  if (existingNick) {
    throw new BadRequestError("사용 불가능한 닉네임입니다.");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { nick },
  });

  return { data: { user: toUserResponse(user) } };
};

/** 프로필 이미지를 업로드한다. */
export const uploadProfileImageService = async (
  userId: number,
  file: FileData
) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { profile_image_url: true },
  });

  const oldImageUrl = currentUser?.profile_image_url;
  const ext = path.extname(file.originalname);
  const uuid = randomUUID();
  const fileName = `profile-image/${userId}/${uuid}${ext}`;
  const fileRef = firebaseStorage.file(fileName);

  await fileRef.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
    },
    public: true,
  });

  let user;
  try {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        profile_image_url: fileName,
        profile_image_updated_at: new Date(),
      },
    });
  } catch (dbError) {
    // DB 업데이트 실패 시 업로드한 이미지 정리
    try {
      await fileRef.delete();
    } catch (deleteError) {
      logger.error("DB 업데이트 실패 후 새 이미지 삭제 실패", { error: deleteError });
    }
    throw dbError;
  }

  // 모든 작업 성공 후 기존 이미지 삭제
  if (oldImageUrl) {
    try {
      const oldFileRef = firebaseStorage.file(oldImageUrl);
      await oldFileRef.delete();
    } catch (deleteError) {
      logger.error("기존 프로필 이미지 삭제 실패", { error: deleteError });
    }
  }

  return { data: { user: toUserResponse(user) } };
};

/** 이메일 인증 코드를 발송한다. */
export const sendEmailVerificationService = async (
  userId: number,
  email: string
) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.id === userId) {
      throw new BadRequestError(
        "현재 사용 중인 이메일입니다. 다른 이메일을 입력해주세요."
      );
    }
    throw new BadRequestError("이미 사용 중인 이메일입니다.");
  }

  // race condition 방지를 위해 쿨타임을 먼저 설정
  const resendKey = `email_verify_resend:${userId}`;
  await redis.set(resendKey, "1", "EX", 60);

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);
  const authData = { email, codeHash, attempts: 0 };

  const redisKey = `email_verify:${userId}`;
  await redis.set(redisKey, JSON.stringify(authData), "EX", 300);

  await sendVerificationEmail(email, code);

  return { data: null };
};

/** 이메일 인증 코드를 재발송한다. */
export const resendEmailVerificationService = async (
  userId: number,
  email: string
) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.id === userId) {
      throw new BadRequestError(
        "현재 사용 중인 이메일입니다. 다른 이메일을 입력해주세요."
      );
    }
    throw new BadRequestError("이미 사용 중인 이메일입니다.");
  }

  const resendKey = `email_verify_resend:${userId}`;
  if (await redis.exists(resendKey)) {
    throw new BadRequestError("60초 후 다시 시도해주세요.");
  }

  // race condition 방지를 위해 쿨타임을 먼저 설정
  await redis.set(resendKey, "1", "EX", 60);

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);
  const authData = { email, codeHash, attempts: 0 };

  const redisKey = `email_verify:${userId}`;
  await redis.set(redisKey, JSON.stringify(authData), "EX", 300);

  await sendVerificationEmail(email, code);

  return { data: null };
};

/** 이메일 인증 코드를 검증한다. */
export const verifyEmailService = async (userId: number, code: string) => {
  const redisKey = `email_verify:${userId}`;
  const authDataString = await redis.get(redisKey);

  if (!authDataString) {
    throw new BadRequestError("인증 코드가 만료되었거나 존재하지 않습니다.");
  }

  const authData = JSON.parse(authDataString);

  if (authData.attempts >= 5) {
    throw new BadRequestError(
      "최대 시도 횟수를 초과했습니다. 새로운 인증 코드를 발급받아주세요.",
      { attempts: authData.attempts, maxAttempts: 5 }
    );
  }

  const isCodeValid = await bcrypt.compare(code, authData.codeHash);

  if (!isCodeValid) {
    authData.attempts += 1;

    const ttl = await redis.ttl(redisKey);
    if (ttl > 0) {
      await redis.set(redisKey, JSON.stringify(authData), "EX", ttl);
    } else {
      throw new BadRequestError(
        "인증 코드가 만료되었습니다. 새로운 인증 코드를 발급받아주세요."
      );
    }

    throw new BadRequestError("인증 코드가 일치하지 않습니다.", {
      attempts: authData.attempts,
      maxAttempts: 5,
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      email: authData.email,
      email_verified_at: new Date(),
    },
  });

  await redis.del(redisKey);

  return { data: null };
};

/** 비밀번호를 변경한다. */
export const changePasswordService = async (
  userId: number,
  oldPw: string,
  newPw: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deleted_at) {
    throw new BadRequestError("사용자를 찾을 수 없습니다.");
  }

  if (!user.pw) {
    throw new BadRequestError("소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.");
  }

  const isPasswordValid = await bcrypt.compare(oldPw, user.pw);
  if (!isPasswordValid) {
    throw new BadRequestError("현재 비밀번호가 일치하지 않습니다.");
  }

  if (oldPw === newPw) {
    throw new BadRequestError("새 비밀번호가 현재 비밀번호와 같습니다.");
  }

  const hashedNewPw = await bcrypt.hash(newPw, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { pw: hashedNewPw },
  });

  // 다른 기기 로그아웃을 위해 모든 세션 무효화
  await deleteAllRefreshTokens(userId);

  return { data: null };
};

/** 커뮤니티 활동 통계를 조회한다. */
export const getUserCommunityStatsService = async (userId: number) => {
  const [postCount, commentCount, likeCount] = await Promise.all([
    prisma.post.count({
      where: {
        author_id: userId,
        deleted_at: null,
      },
    }),
    prisma.post_comment.count({
      where: {
        author_id: userId,
        deleted_at: null,
      },
    }),
    prisma.post_like.count({
      where: {
        user_id: userId,
        post: {
          deleted_at: null,
        },
      },
    }),
  ]);

  return {
    data: {
      stats: {
        postCount,
        commentCount,
        likeCount,
      },
    },
  };
};

/**
 * 회원탈퇴를 처리한다.
 *
 * @remarks
 * 소프트 삭제: 게시글, 댓글, 종목댓글, AI 분석이력
 * 물리 삭제: 좋아요, 관심종목, 알림, 인증정보
 */
export const withdrawUserService = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deleted_at) {
    throw new NotFoundError("사용자를 찾을 수 없습니다.");
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.post.updateMany({
      where: { author_id: userId },
      data: { deleted_at: now },
    }),
    prisma.post_comment.updateMany({
      where: { author_id: userId },
      data: { deleted_at: now },
    }),
    prisma.stock_comment.updateMany({
      where: { author_id: userId },
      data: { deleted_at: now },
    }),
    prisma.ai_inference_history.updateMany({
      where: { user_id: userId },
      data: { deleted_at: now },
    }),

    prisma.post_like.deleteMany({ where: { user_id: userId } }),
    prisma.stock_watch_list.deleteMany({ where: { user_id: userId } }),
    prisma.notification.deleteMany({
      where: { OR: [{ user_id: userId }, { actor_id: userId }] },
    }),
    prisma.auth_provider.deleteMany({ where: { user_id: userId } }),

    prisma.user.update({
      where: { id: userId },
      data: {
        deleted_at: now,
        email: user.email ? `${user.email}_${now.getTime()}_deleted` : null,
        nick: `${user.nick}_${now.getTime()}_deleted`,
      },
    }),
  ]);

  await deleteAllRefreshTokens(userId);

  return { data: null };
};
