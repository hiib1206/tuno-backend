import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { firebaseStorage } from "../config/firebase";
import prisma from "../config/prisma";
import redis from "../config/redis";
import { sendError, sendSuccess } from "../utils/commonResponse";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "../utils/email";
import { deleteAllRefreshTokens, UserPayload } from "../utils/token";
import { toUserResponse } from "../utils/user";

// me
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.user as UserPayload;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { auth_providers: true },
    });

    if (!user || user.deleted_at) {
      return sendError(res, 401, "사용자를 찾을 수 없습니다.");
    }

    return sendSuccess(res, 200, "내 정보를 조회했습니다.", {
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

// 닉네임 변경
export const changeNickname = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { nick } = req.validated?.body;

    const existingNick = await prisma.user.findUnique({
      where: { nick: nick as string },
    });

    if (existingNick) {
      return sendError(res, 400, "사용 불가능한 닉네임입니다.");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { nick },
    });

    return sendSuccess(res, 200, "닉네임이 변경되었습니다.", {
      user: toUserResponse(user),
    });
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
    const { userId } = req.user as UserPayload;
    const file = req.file;

    if (!file) {
      return sendError(res, 400, "파일이 존재하지 않습니다.");
    }

    // 기존 사용자 정보 조회
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { profile_image_url: true },
    });

    // 기존 이미지 URL 저장 (나중에 삭제하기 위해)
    const oldImageUrl = currentUser?.profile_image_url;

    // 새 파일명 생성 (항상 새로 생성)
    const ext = path.extname(file.originalname); // ".png"
    const uuid = randomUUID();
    const fileName = `profile-image/${userId}/${uuid}${ext}`; // "profile-image/1/uuid.png"

    // Firebase Storage 파일 참조 생성
    const fileRef = firebaseStorage.file(fileName);

    // 새 이미지 업로드
    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
      public: true,
    });

    // DB에 프로필 이미지 URL 저장
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
      // DB 업데이트 실패 시 새로 업로드한 이미지 삭제
      try {
        await fileRef.delete();
      } catch (deleteError) {
        console.error("DB 업데이트 실패 후 새 이미지 삭제 실패:", deleteError);
      }
      // 원래 에러를 다시 던져서 상위 catch에서 처리
      throw dbError;
    }

    // 기존 이미지 삭제 (모든 작업이 성공한 후)
    if (oldImageUrl) {
      try {
        const oldFileRef = firebaseStorage.file(oldImageUrl);
        await oldFileRef.delete();
      } catch (deleteError) {
        // 삭제 실패해도 에러를 던지지 않음 (이미 새 이미지 업로드 및 DB 업데이트 완료)
        console.error("기존 프로필 이미지 삭제 실패:", deleteError);
      }
    }

    return sendSuccess(res, 200, "프로필 이미지가 업로드되었습니다.", {
      user: toUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// 이메일 인증 요청 (마이페이지)
export const sendEmailVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { email } = req.validated?.body;

    // 이메일 중복 확인 (현재 사용자 제외)
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.id === userId) {
        return sendError(
          res,
          400,
          "현재 사용 중인 이메일입니다. 다른 이메일을 입력해주세요."
        );
      }
      return sendError(res, 400, "이미 사용 중인 이메일입니다.");
    }

    // 쿨타임 설정 (먼저 실행 - race condition 방지)
    const resendKey = `email_verify_resend:${userId}`;
    await redis.set(resendKey, "1", "EX", 60); // 60초

    // 6자리 인증 코드 생성
    const code = generateVerificationCode();

    // 코드 해시 생성
    const codeHash = await bcrypt.hash(code, 10);

    // Redis에 저장할 데이터
    const authData = {
      email,
      codeHash,
      attempts: 0,
    };

    // Redis에 저장 (기존 데이터 덮어쓰기)
    const redisKey = `email_verify:${userId}`;
    await redis.set(redisKey, JSON.stringify(authData), "EX", 300); // 5분

    // 이메일 발송
    await sendVerificationEmail(email, code);

    return sendSuccess(res, 200, "인증 코드가 이메일로 발송되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 이메일 인증 재발송 (마이페이지)
export const resendEmailVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { email } = req.validated?.body;

    // 이메일 중복 확인 (현재 사용자 제외)
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.id === userId) {
        return sendError(
          res,
          400,
          "현재 사용 중인 이메일입니다. 다른 이메일을 입력해주세요."
        );
      }
      return sendError(res, 400, "이미 사용 중인 이메일입니다.");
    }

    // 1. 재발송 쿨타임 체크
    const resendKey = `email_verify_resend:${userId}`;
    if (await redis.exists(resendKey)) {
      return sendError(res, 400, "60초 후 다시 시도해주세요.");
    }

    // 2. 쿨타임 설정 (먼저 실행 - race condition 방지)
    await redis.set(resendKey, "1", "EX", 60); // 60초

    // 3. 새 인증 코드 생성
    const code = generateVerificationCode();

    // 4. 코드 해시 생성
    const codeHash = await bcrypt.hash(code, 10);

    // 5. 인증 정보 완전 초기화
    const authData = {
      email,
      codeHash,
      attempts: 0,
    };

    const redisKey = `email_verify:${userId}`;
    await redis.set(redisKey, JSON.stringify(authData), "EX", 300); // 5분

    // 6. 이메일 발송
    await sendVerificationEmail(email, code);

    return sendSuccess(res, 200, "인증 코드가 재전송되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 이메일 인증 검증 (마이페이지)
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { code } = req.validated?.body;

    // Redis에서 인증 데이터 조회
    const redisKey = `email_verify:${userId}`;
    const authDataString = await redis.get(redisKey);

    // TTL 만료 여부 확인
    if (!authDataString) {
      return sendError(res, 400, "인증 코드가 만료되었거나 존재하지 않습니다.");
    }

    const authData = JSON.parse(authDataString);

    // attempts >= 5 체크
    if (authData.attempts >= 5) {
      return sendError(
        res,
        400,
        "최대 시도 횟수를 초과했습니다. 새로운 인증 코드를 발급받아주세요.",
        {
          attempts: authData.attempts,
          maxAttempts: 5,
        }
      );
    }

    // 코드 검증
    const isCodeValid = await bcrypt.compare(code, authData.codeHash);

    if (!isCodeValid) {
      // 실패 시 attempts + 1
      authData.attempts += 1;

      // 기존 TTL 유지하여 Redis 갱신
      const ttl = await redis.ttl(redisKey);
      // -2: 키가 없음, -1: 키는 있지만 TTL 없음
      if (ttl > 0) {
        await redis.set(redisKey, JSON.stringify(authData), "EX", ttl);
      } else {
        // TTL이 만료되었거나 설정되지 않은 경우 에러 반환
        return sendError(
          res,
          400,
          "인증 코드가 만료되었습니다. 새로운 인증 코드를 발급받아주세요."
        );
      }

      return sendError(res, 400, "인증 코드가 일치하지 않습니다.", {
        attempts: authData.attempts,
        maxAttempts: 5,
      });
    }

    // 성공 시 처리
    // user.email 업데이트 및 email_verified_at 설정
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: authData.email,
        email_verified_at: new Date(),
      },
    });

    // Redis 즉시 삭제
    await redis.del(redisKey);

    return sendSuccess(res, 200, "이메일 인증이 완료되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 비밀번호 변경 로직
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { oldPw, newPw } = req.validated?.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deleted_at) {
      return sendError(res, 400, "사용자를 찾을 수 없습니다.");
    }

    if (!user.pw) {
      return sendError(
        res,
        400,
        "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다."
      );
    }

    const isPasswordValid = await bcrypt.compare(oldPw, user.pw);
    if (!isPasswordValid) {
      return sendError(res, 400, "현재 비밀번호가 일치하지 않습니다.");
    }

    if (oldPw === newPw) {
      return sendError(res, 400, "새 비밀번호가 현재 비밀번호와 같습니다.");
    }

    const hashedNewPw = await bcrypt.hash(newPw, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { pw: hashedNewPw },
    });

    // 모든 세션 무효화 (다른 기기 로그아웃)
    await deleteAllRefreshTokens(userId);

    return sendSuccess(res, 200, "비밀번호가 변경되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 커뮤니티 통계 조회
export const getUserCommunityStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;

    // 세 개의 count 쿼리를 병렬로 실행
    const [postCount, commentCount, likeCount] = await Promise.all([
      // 나의 게시글 개수 (삭제되지 않은 것만)
      prisma.post.count({
        where: {
          author_id: userId,
          deleted_at: null,
        },
      }),
      // 나의 댓글 개수 (삭제되지 않은 것만)
      prisma.post_comment.count({
        where: {
          author_id: userId,
          deleted_at: null,
        },
      }),
      // 내가 보낸 좋아요 개수 (삭제되지 않은 게시글만)
      prisma.post_like.count({
        where: {
          user_id: userId,
          post: {
            deleted_at: null, // 삭제되지 않은 게시글만 카운트
          },
        },
      }),
    ]);

    return sendSuccess(res, 200, "커뮤니티 통계를 조회했습니다.", {
      stats: {
        postCount,
        commentCount,
        likeCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 회원탈퇴
export const withdrawUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deleted_at) {
      return sendError(res, 404, "사용자를 찾을 수 없습니다.");
    }

    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: {
        deleted_at: now,
        // email suffix 추가 (재가입 허용)
        email: user.email ? `${user.email}_${now.getTime()}_deleted` : null,
        // username, nick도 재사용 허용
        username: user.username
          ? `${user.username}_${now.getTime()}_deleted`
          : null,
        nick: `${user.nick}_${now.getTime()}_deleted`,
      },
    });

    // 강제 로그아웃
    await deleteAllRefreshTokens(userId);

    return sendSuccess(res, 200, "회원탈퇴가 완료되었습니다.");
  } catch (error) {
    next(error);
  }
};
