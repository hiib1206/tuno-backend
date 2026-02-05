import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { firebaseStorage } from "../config/firebase";
import prisma from "../config/prisma";
import redis from "../config/redis";
import { post_category } from "../generated/prisma/client";
import {
  DeletePostsSchema,
  GetPostListSchema,
  TogglePostLikesSchema,
} from "../schema/post.schema";
import { getPostListService } from "../service/post.service";
import { ENTITY_TYPES } from "../types/entity-type";
import { sendError, sendSuccess } from "../utils/commonResponse";
import { extractPathFromUrl, toPublicUrl } from "../utils/firebase";
import { toPostResponse } from "../utils/post";
import { getClientIp } from "../utils/request";
import { extractImageUrls, updateImageUrlsInContent } from "../utils/tiptap";
import { UserPayload } from "../utils/token";

// 게시글 목록 조회
export const getPostList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const queryParams = req.validated?.query as GetPostListSchema;
    const currentUserId = (req.user as UserPayload | undefined)?.userId;

    const result = await getPostListService({
      ...queryParams,
      currentUserId, // 좋아요 여부 확인용
      // authorId는 전달하지 않음 (전체 게시글 조회)
    });

    return sendSuccess(res, 200, "게시글 목록을 조회했습니다.", result);
  } catch (error) {
    next(error);
  }
};

// 내 게시글 목록 조회
export const getMyPostList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload; // 인증 필수
    const queryParams = req.validated?.query as GetPostListSchema;

    const result = await getPostListService({
      ...queryParams,
      authorId: userId, // 내 게시글만 필터링
      currentUserId: userId, // 좋아요 여부 확인용
    });

    return sendSuccess(res, 200, "내 게시글 목록을 조회했습니다.", result);
  } catch (error) {
    next(error);
  }
};

// 게시글 단일 조회
export const getPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const postId = BigInt(req.params.id);
    const postIdStr = postId.toString();

    // 로그인한 사용자 확인 (include 조건을 위해 먼저 확인)
    const currentUserId = (req.user as UserPayload)?.userId ?? undefined;

    // 게시글 조회 (삭제되지 않은 게시글만)
    // include로 좋아요 정보도 함께 조회 (쿼리 1번으로 최적화)
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: true,
        // 현재 유저의 좋아요 기록만 포함 (없으면 빈 배열)
        post_likes:
          currentUserId !== undefined
            ? {
              where: { user_id: currentUserId as number },
              take: 1, // 존재 여부만 확인하면 되므로 1개만 가져옴
            }
            : false,
      },
    });

    if (!post || post.deleted_at) {
      return sendError(res, 404, "게시글을 찾을 수 없습니다.");
    }
    // 좋아요 여부 확인 (include로 가져온 데이터 사용)
    const isLiked =
      currentUserId !== undefined && "post_likes" in post
        ? post.post_likes.length > 0
        : undefined;

    // 로그인한 사용자가 본인이 작성한 게시글인지 확인
    const isAuthor = currentUserId && post.author_id === currentUserId;

    let currentViewCount = post.view_count;
    // 작성자가 아닌 경우에만 조회수 증가 처리
    if (!isAuthor) {
      // 중복 조회 방지를 위한 식별자 생성 (iP 사용)
      const identifier = `ip:${getClientIp(req)}`;

      // Redis 키 설정
      const checkKey = `post:view:check:${postIdStr}:${identifier}`;
      const countKey = `post:view:count:${postIdStr}`;

      // 중복 체크 (EXISTS)
      const isAlreadyViewed = await redis.exists(checkKey);

      if (!isAlreadyViewed) {
        // 처음 읽는 사용자이므로 조회수 증가 및 중복 체크 키 생성
        try {
          // 조회수 카운트 증가 (INCR)
          await redis.incr(countKey);

          // 중복 체크 키 생성 (TTL 24시간)
          await redis.setex(checkKey, 24 * 60 * 60, "1"); // 24시간 = 86400초

          // Redis 버퍼에서 현재 조회수 가져오기 (DB 조회수와 합산)
          const bufferCount = await redis.get(countKey);
          if (bufferCount) {
            currentViewCount = post.view_count + parseInt(bufferCount, 10);
          }
        } catch (redisError) {
          // Redis 오류 시 로그만 남기고 계속 진행 (DB 조회수 사용)
          console.error("Redis 조회수 증가 실패:", redisError);
          // DB 조회수는 그대로 사용
        }
      } else {
        // 이미 조회한 사용자 - Redis 버퍼에서 현재 조회수만 가져오기
        try {
          const bufferCount = await redis.get(countKey);
          if (bufferCount) {
            // DB 조회수 + Redis 버퍼 조회수
            currentViewCount = post.view_count + parseInt(bufferCount, 10);
          }
        } catch (redisError) {
          // Redis 오류 시 DB 조회수만 사용
          console.error("Redis 조회수 조회 실패:", redisError);
        }
      }
    }

    // 응답 데이터 구성
    const responseData = toPostResponse(post, currentViewCount, isLiked);
    return sendSuccess(res, 200, "게시글을 조회했습니다.", {
      post: responseData,
    });
  } catch (error) {
    next(error);
  }
};

// 게시글 저장
export const createPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 업로드된 파일 경로 추적 (에러 발생 시 정리용)
  const uploadedFilePaths: string[] = [];

  try {
    const { userId } = req.user as UserPayload;
    const { title, content, category, blobUrlMapping } = req.body;
    const files = req.files as Express.Multer.File[];

    // Tiptap JSON 파싱
    const contentJson = JSON.parse(content);

    // 이미지 URL 배열로 추출 (blob URL 포함)
    const imageUrls = extractImageUrls(contentJson);

    // 게시글 생성 (트랜잭션 사용)
    const post = await prisma.$transaction(async (tx) => {
      // 1. 게시글 생성 (postId가 필요하므로 먼저 생성, content는 나중에 업데이트)
      const newPost = await tx.post.create({
        data: {
          title,
          content: "", // 이미지 URL 교체 후 업데이트할 예정
          category,
          author_id: userId,
        },
      });

      const postId = newPost.id.toString();
      const urlMap: Record<string, string> = {}; // blob URL -> 새 URL 매핑
      // 2. blob URL에 해당하는 파일들을 Firebase Storage에 업로드
      for (const blobUrl of imageUrls) {
        // blob URL이 아닌 경우 (이미 Firebase Storage URL 등) 건너뛰기
        if (!blobUrl.startsWith("blob:")) {
          // 이미 실제 저장소에 있으면 그대로 사용
          urlMap[blobUrl] = blobUrl;
          continue;
        }

        // blobUrlMapping에서 파일 인덱스 찾기
        const fileIndex = blobUrlMapping[blobUrl];
        if (fileIndex === undefined || fileIndex === null) {
          throw new Error(
            `blob URL에 해당하는 파일 인덱스를 찾을 수 없습니다: ${blobUrl}`
          );
        }

        // files 배열에서 해당 파일 찾기
        const file = files[fileIndex];
        if (!file) {
          throw new Error(
            `파일 인덱스 ${fileIndex}에 해당하는 파일을 찾을 수 없습니다.`
          );
        }

        // 새 경로 생성: post-images/{postId}/{uuid}.{ext}
        const uuid = randomUUID();
        const ext = path.extname(file.originalname);
        const newPath = `post-images/${postId}/${uuid}${ext}`;

        // Firebase Storage 파일 참조 생성
        const fileRef = firebaseStorage.file(newPath);

        // 파일 업로드
        await fileRef.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
          },
          public: true,
        });

        // 업로드된 파일 경로 저장 (에러 발생 시 정리용)
        uploadedFilePaths.push(newPath);

        // 새 공개 URL 생성
        const newUrl = toPublicUrl(newPath);
        if (!newUrl) {
          throw new Error(`이미지 URL 생성에 실패했습니다: ${newPath}`);
        }

        urlMap[blobUrl] = newUrl;

        // 3. Media 레코드 생성
        await tx.media.create({
          data: {
            entity_type: ENTITY_TYPES.POST,
            entity_id: newPost.id,
            url: newUrl,
            mime_type: file.mimetype,
          },
        });
      }

      // 4. content JSON에서 이미지 URL 업데이트
      const updatedContentJson = updateImageUrlsInContent(contentJson, urlMap);
      const updatedContent = JSON.stringify(updatedContentJson);

      // 5. 게시글 content 업데이트
      const updatedPost = await tx.post.update({
        where: { id: newPost.id },
        data: { content: updatedContent },
      });

      return updatedPost;
    });

    // 응답 데이터 구성
    const responseData = toPostResponse(post);

    return sendSuccess(res, 201, "게시글이 저장되었습니다.", {
      post: responseData,
    });
  } catch (error) {
    // 트랜잭션 실패 시 Firebase Storage에 업로드된 파일들 정리
    if (uploadedFilePaths.length > 0) {
      console.warn(
        `트랜잭션 실패로 인해 ${uploadedFilePaths.length}개의 파일을 정리합니다.`
      );
      for (const filePath of uploadedFilePaths) {
        try {
          const fileRef = firebaseStorage.file(filePath);
          const [exists] = await fileRef.exists();
          if (exists) {
            await fileRef.delete();
            console.log(`정리 완료: ${filePath}`);
          }
        } catch (cleanupError) {
          console.error(`파일 정리 실패 (${filePath}):`, cleanupError);
          // 정리 실패해도 원래 에러를 우선 처리
        }
      }
    }
    next(error);
  }
};

// 게시글 수정
export const updatePost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 업로드된 파일 경로 추적 (에러 발생 시 정리용)
  const uploadedFilePaths: string[] = [];

  try {
    const { userId } = req.user as UserPayload;
    const postId = BigInt(req.params.id);
    const { title, content, category, blobUrlMapping } = req.body;
    const files = req.files as Express.Multer.File[];

    // 게시글 조회 (기존 Media 레코드 포함)
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: true,
      },
    });

    // 게시글이 존재하지 않는 경우
    if (!existingPost) {
      return sendError(res, 404, "게시글을 찾을 수 없습니다.");
    }

    // 이미 삭제된 게시글인 경우
    if (existingPost.deleted_at) {
      return sendError(res, 400, "이미 삭제된 게시글입니다.");
    }

    // 작성자 확인
    if (existingPost.author_id !== userId) {
      return sendError(res, 403, "게시글을 수정할 권한이 없습니다.");
    }

    // 업데이트할 데이터 준비
    const updateData: {
      title?: string;
      content?: string;
      category?: post_category;
    } = {};

    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;

    // content가 제공된 경우 이미지 처리
    if (content !== undefined) {
      // Tiptap JSON 파싱
      const contentJson = JSON.parse(content);

      // 이미지 URL 배열로 추출 (blob URL 포함)
      const newImageUrls = extractImageUrls(contentJson);

      // 게시글 업데이트 (트랜잭션 사용)
      const updatedPost = await prisma.$transaction(async (tx) => {
        // 1. 기존 Media 레코드 조회
        const existingMedia = await tx.media.findMany({
          where: {
            entity_type: ENTITY_TYPES.POST,
            entity_id: postId,
          },
        });

        // 2. 기존 이미지 URL 추출
        const existingImageUrls = existingMedia.map((m) => m.url);

        // 3. 사용되지 않는 이미지 찾기 (기존에 있지만 새 content에 없는 이미지)
        const unusedImageUrls = existingImageUrls.filter(
          (url) => !newImageUrls.includes(url)
        );

        // 4. 사용되지 않는 이미지 삭제 (Media 레코드 + Firebase Storage)
        for (const unusedUrl of unusedImageUrls) {
          // Media 레코드 삭제
          await tx.media.deleteMany({
            where: {
              entity_type: ENTITY_TYPES.POST,
              entity_id: postId,
              url: unusedUrl,
            },
          });

          // Firebase Storage에서 파일 삭제
          const filePath = extractPathFromUrl(unusedUrl);
          if (filePath) {
            try {
              const fileRef = firebaseStorage.file(filePath);
              const [exists] = await fileRef.exists();
              if (exists) {
                await fileRef.delete();
              }
            } catch (deleteError) {
              console.error(`이미지 삭제 실패 (${unusedUrl}):`, deleteError);
              // 삭제 실패해도 계속 진행
            }
          }
        }

        // 5. 새로운 blob URL 이미지 업로드
        const urlMap: Record<string, string> = {}; // blob URL -> 새 URL 매핑

        for (const imageUrl of newImageUrls) {
          // blob URL이 아닌 경우 (이미 Firebase Storage URL 등) 건너뛰기
          if (!imageUrl.startsWith("blob:")) {
            urlMap[imageUrl] = imageUrl;
            continue;
          }

          // blobUrlMapping에서 파일 인덱스 찾기
          const fileIndex = blobUrlMapping[imageUrl];
          if (fileIndex === undefined || fileIndex === null) {
            throw new Error(
              `blob URL에 해당하는 파일 인덱스를 찾을 수 없습니다: ${imageUrl}`
            );
          }

          // files 배열에서 해당 파일 찾기
          const file = files[fileIndex];
          if (!file) {
            throw new Error(
              `파일 인덱스 ${fileIndex}에 해당하는 파일을 찾을 수 없습니다.`
            );
          }

          // 새 경로 생성: post-images/{postId}/{uuid}.{ext}
          const uuid = randomUUID();
          const ext = path.extname(file.originalname);
          const newPath = `post-images/${postId.toString()}/${uuid}${ext}`;

          // Firebase Storage 파일 참조 생성
          const fileRef = firebaseStorage.file(newPath);

          // 파일 업로드
          await fileRef.save(file.buffer, {
            metadata: {
              contentType: file.mimetype,
            },
            public: true,
          });

          // 업로드된 파일 경로 저장 (에러 발생 시 정리용)
          uploadedFilePaths.push(newPath);

          // 새 공개 URL 생성
          const newUrl = toPublicUrl(newPath);
          if (!newUrl) {
            throw new Error(`이미지 URL 생성에 실패했습니다: ${newPath}`);
          }

          urlMap[imageUrl] = newUrl;

          // 6. Media 레코드 생성
          await tx.media.create({
            data: {
              entity_type: ENTITY_TYPES.POST,
              entity_id: postId,
              url: newUrl,
              mime_type: file.mimetype,
            },
          });
        }

        // 7. content JSON에서 이미지 URL 업데이트
        const updatedContentJson = updateImageUrlsInContent(
          contentJson,
          urlMap
        );
        updateData.content = JSON.stringify(updatedContentJson);

        // 8. 게시글 업데이트
        const updatedPost = await tx.post.update({
          where: { id: postId },
          data: updateData,
          include: {
            author: true,
          },
        });

        return updatedPost;
      });

      // 응답 데이터 구성
      const responseData = toPostResponse(updatedPost);

      return sendSuccess(res, 200, "게시글이 수정되었습니다.", {
        post: responseData,
      });
    } else {
      // content가 제공되지 않은 경우 단순 업데이트
      const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: updateData,
        include: {
          author: true,
        },
      });

      // 응답 데이터 구성
      const responseData = toPostResponse(updatedPost);

      return sendSuccess(res, 200, "게시글이 수정되었습니다.", {
        post: responseData,
      });
    }
  } catch (error) {
    // 트랜잭션 실패 시 Firebase Storage에 업로드된 파일들 정리
    if (uploadedFilePaths.length > 0) {
      console.warn(
        `트랜잭션 실패로 인해 ${uploadedFilePaths.length}개의 파일을 정리합니다.`
      );
      for (const filePath of uploadedFilePaths) {
        try {
          const fileRef = firebaseStorage.file(filePath);
          const [exists] = await fileRef.exists();
          if (exists) {
            await fileRef.delete();
            console.log(`정리 완료: ${filePath}`);
          }
        } catch (cleanupError) {
          console.error(`파일 정리 실패 (${filePath}):`, cleanupError);
        }
      }
    }

    // BigInt 변환 실패 등의 에러 처리
    if (error instanceof Error && error.message.includes("Invalid")) {
      return sendError(res, 400, "유효하지 않은 게시글 ID입니다.");
    }

    next(error);
  }
};

// 게시글 삭제
export const deletePost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const postId = BigInt(req.params.id);

    // 게시글 조회
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    // 게시글이 존재하지 않는 경우
    if (!post) {
      return sendError(res, 404, "게시글을 찾을 수 없습니다.");
    }

    // 이미 삭제된 게시글인 경우
    if (post.deleted_at) {
      return sendError(res, 400, "이미 삭제된 게시글입니다.");
    }

    // 작성자 확인
    if (post.author_id !== userId) {
      return sendError(res, 403, "게시글을 삭제할 권한이 없습니다.");
    }

    // Soft delete (deleted_at 설정)
    await prisma.post.update({
      where: { id: postId },
      data: { deleted_at: new Date() },
    });

    return sendSuccess(res, 200, "게시글이 삭제되었습니다.");
  } catch (error) {
    next(error);
  }
};

// 여러 게시글 삭제 (개선 버전)
export const deletePosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { ids } = req.validated?.body as DeletePostsSchema;

    const success: Array<{ id: string; message: string }> = [];
    const failed: Array<{ id: string; message: string }> = [];

    // 1. BigInt 변환
    const postIds = ids.map((idStr) => BigInt(idStr));

    // 2. 한 번에 모든 게시글 조회
    const posts = await prisma.post.findMany({
      where: {
        id: { in: postIds },
      },
      select: {
        id: true,
        author_id: true,
        deleted_at: true,
      },
    });

    // 3. 조회된 게시글을 Map으로 변환 (빠른 검색)
    const postMap = new Map(posts.map((p) => [p.id.toString(), p]));

    // 4. 삭제 가능한 게시글 ID 수집 및 실패 케이스 처리
    const deletableIds: bigint[] = [];

    for (const idStr of ids) {
      const post = postMap.get(idStr);

      // 게시글이 존재하지 않는 경우
      if (!post) {
        failed.push({
          id: idStr,
          message: "게시글을 찾을 수 없습니다.",
        });
        continue;
      }

      // 이미 삭제된 게시글인 경우
      if (post.deleted_at) {
        failed.push({
          id: idStr,
          message: "이미 삭제된 게시글입니다.",
        });
        continue;
      }

      // 작성자 확인
      if (post.author_id !== userId) {
        failed.push({
          id: idStr,
          message: "게시글을 삭제할 권한이 없습니다.",
        });
        continue;
      }

      // 삭제 가능
      deletableIds.push(BigInt(idStr));
    }

    // 5. 한 번에 일괄 삭제 (updateMany 사용)
    if (deletableIds.length > 0) {
      await prisma.post.updateMany({
        where: {
          id: { in: deletableIds },
        },
        data: {
          deleted_at: new Date(),
        },
      });

      // 성공 목록 생성
      for (const id of deletableIds) {
        success.push({
          id: id.toString(),
          message: "게시글이 삭제되었습니다.",
        });
      }
    }

    return sendSuccess(res, 200, "게시글 삭제가 완료되었습니다.", {
      success,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

// 게시글 좋아요 토글
export const togglePostLike = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const postId = BigInt(req.params.id);

    // 게시글 존재 여부 및 삭제 여부 확인
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return sendError(res, 404, "게시글을 찾을 수 없습니다.");
    }

    if (post.deleted_at) {
      return sendError(res, 400, "삭제된 게시글에는 좋아요를 할 수 없습니다.");
    }

    // 현재 사용자의 좋아요 존재 여부 확인
    const existingLike = await prisma.post_like.findUnique({
      where: {
        post_id_user_id: {
          post_id: postId,
          user_id: userId,
        },
      },
    });

    // 트랜잭션으로 좋아요 생성/삭제 및 like_count 동기화
    const result = await prisma.$transaction(async (tx) => {
      if (existingLike) {
        // 좋아요 삭제
        await tx.post_like.delete({
          where: {
            post_id_user_id: {
              post_id: postId,
              user_id: userId,
            },
          },
        });

        // like_count 감소
        const updatedPost = await tx.post.update({
          where: { id: postId },
          data: {
            like_count: {
              decrement: 1,
            },
          },
        });

        return {
          isLiked: false,
          likeCount: updatedPost.like_count,
        };
      } else {
        // 좋아요 생성
        await tx.post_like.create({
          data: {
            post_id: postId,
            user_id: userId,
          },
        });

        // like_count 증가
        const updatedPost = await tx.post.update({
          where: { id: postId },
          data: {
            like_count: {
              increment: 1,
            },
          },
        });

        return {
          isLiked: true,
          likeCount: updatedPost.like_count,
        };
      }
    });

    return sendSuccess(
      res,
      200,
      result.isLiked ? "좋아요가 추가되었습니다." : "좋아요가 취소되었습니다.",
      result
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 여러 게시글 좋아요 일괄 취소
 * POST /api/post/likes
 */
export const togglePostLikes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { ids } = req.validated?.body as TogglePostLikesSchema;

    const success: Array<{ id: string; message: string }> = [];
    const failed: Array<{ id: string; message: string }> = [];

    // 1. BigInt 변환
    const postIds = ids.map((idStr) => BigInt(idStr));

    // 2. 해당 게시글들의 좋아요 존재 여부 확인
    const existingLikes = await prisma.post_like.findMany({
      where: {
        post_id: { in: postIds },
        user_id: userId,
      },
      select: {
        post_id: true,
      },
    });

    // 3. 좋아요가 있는 post_id를 Set으로 변환 (빠른 검색)
    const likedPostIds = new Set(
      existingLikes.map((like) => like.post_id.toString())
    );

    // 4. 취소 가능한 게시글 ID 수집 및 실패 케이스 처리
    const togglableIds: bigint[] = [];

    for (const idStr of ids) {
      // 좋아요가 존재하지 않는 경우 실패 처리
      if (!likedPostIds.has(idStr)) {
        failed.push({
          id: idStr,
          message: "좋아요가 존재하지 않습니다.",
        });
        continue;
      }

      // 취소 가능
      togglableIds.push(BigInt(idStr));
    }

    // 5. 트랜잭션으로 일괄 취소 및 like_count 감소
    if (togglableIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        // 좋아요 일괄 삭제
        await tx.post_like.deleteMany({
          where: {
            post_id: { in: togglableIds },
            user_id: userId,
          },
        });

        // 각 게시글의 like_count 감소
        for (const postId of togglableIds) {
          await tx.post.update({
            where: { id: postId },
            data: {
              like_count: {
                decrement: 1,
              },
            },
          });
        }
      });

      // 성공 목록 생성
      for (const id of togglableIds) {
        success.push({
          id: id.toString(),
          message: "좋아요가 취소되었습니다.",
        });
      }
    }

    return sendSuccess(res, 200, "좋아요 취소가 완료되었습니다.", {
      success,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 내가 좋아요한 게시글 목록 조회
 * GET /api/post/me/liked
 */
export const getMyLikedPostList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { page, limit, order } = req.validated?.query as GetPostListSchema;

    const offset = (page - 1) * limit;

    // 정렬 방향 처리 (기본값: desc)
    const sortOrder = order?.toLowerCase() === "asc" ? "asc" : "desc";

    // 1단계: post_like 조회 (인덱스 [user_id, created_at] 활용)
    // 삭제되지 않은 게시글의 좋아요만 조회
    const [likes, totalCount] = await Promise.all([
      prisma.post_like.findMany({
        where: {
          user_id: userId,
          post: {
            deleted_at: null, // 삭제되지 않은 게시글만
          },
        },
        orderBy: { created_at: sortOrder }, // 좋아요한 시간순 정렬
        skip: offset,
        take: limit,
        select: { post_id: true },
      }),
      prisma.post_like.count({
        where: {
          user_id: userId,
          post: {
            deleted_at: null, // 삭제되지 않은 게시글만 카운트
          },
        },
      }),
    ]);

    // 좋아요한 게시글이 없는 경우
    if (likes.length === 0) {
      const totalPages = Math.ceil(totalCount / limit);
      return sendSuccess(res, 200, "좋아요한 게시글이 없습니다.", {
        list: [],
        totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      });
    }

    // 2단계: post_id 목록 추출
    const postIds = likes.map((like) => like.post_id);

    // 3단계: 해당 post_id로 게시글 조회
    const posts = await prisma.post.findMany({
      where: {
        id: { in: postIds },
        deleted_at: null,
      },
      include: { author: true },
    });

    // 4단계: 좋아요 시간순 유지 (postIds 순서대로 정렬)
    const postsMap = new Map(posts.map((post) => [post.id.toString(), post]));
    const orderedPosts = postIds
      .map((id) => postsMap.get(id.toString()))
      .filter((post): post is (typeof posts)[0] => post !== undefined);

    // 5단계: Redis 조회수 합산
    const postIdStrings = orderedPosts.map((post) => post.id.toString());
    const redisKeys = postIdStrings.map((id) => `post:view:count:${id}`);
    const bufferCounts: (string | null)[] =
      redisKeys.length > 0
        ? await redis
          .mget(...redisKeys)
          .catch(() => new Array(redisKeys.length).fill(null))
        : [];

    // 6단계: 최종 응답 매핑 (isLiked는 항상 true)
    const list = orderedPosts.map((post, index) => {
      const bufferCount = parseInt(bufferCounts[index] || "0", 10);
      const totalViewCount = post.view_count + bufferCount;
      return toPostResponse(post, totalViewCount, true); // 좋아요한 게시글이므로 항상 true
    });

    const totalPages = Math.ceil(totalCount / limit);

    return sendSuccess(res, 200, "좋아요한 게시글 목록을 조회했습니다.", {
      list,
      totalCount,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    next(error);
  }
};
