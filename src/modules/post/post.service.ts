import { randomUUID } from "node:crypto";
import path from "node:path";
import { firebaseStorage } from "../../config/firebase";
import logger from "../../config/logger";
import prisma from "../../config/prisma";
import redis from "../../config/redis";
import { Prisma, post_category } from "../../generated/prisma/client";
import { ENTITY_TYPES } from "../../shared/types/entity-type";
import { extractPathFromUrl, toPublicUrl } from "../../shared/utils/firebase";
import { extractImageUrls, updateImageUrlsInContent } from "../../shared/utils/tiptap";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors/AppError";
import { GetPostListSchema, PostListResponse } from "./post.schema";
import { FileData, toPostResponse } from "./post.utils";

// ============================================================================
// 타입 정의
// ============================================================================

interface GetPostListParams extends GetPostListSchema {
  authorId?: number;
  currentUserId?: number;
}


interface CreatePostParams {
  userId: number;
  title: string;
  content: string;
  category: post_category;
  blobUrlMapping: Record<string, number>;
  files: FileData[];
}

interface UpdatePostParams {
  userId: number;
  postId: bigint;
  title?: string;
  content?: string;
  category?: post_category;
  blobUrlMapping: Record<string, number>;
  files: FileData[];
}

/** 게시글 목록을 조회한다. */
export const getPostListService = async (
  params: GetPostListParams
): Promise<PostListResponse> => {
  const {
    page,
    limit,
    sort,
    order,
    search,
    category,
    authorId,
    currentUserId,
  } = params;

  const offset = (page - 1) * limit;

  const sortFieldMap: Record<string, string> = {
    created_at: "created_at",
    view_count: "view_count",
    comment_count: "comment_count",
    like_count: "like_count",
    title: "title",
  };
  const sortField = sortFieldMap[sort] || "created_at";
  const sortOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

  let posts: any[];
  let totalCount: number;

  if (search) {
    const searchTerm = `%${search.trim()}%`;
    const categoryCondition = category
      ? Prisma.sql`AND p.category = ${category}`
      : Prisma.sql``;

    const authorCondition = authorId
      ? Prisma.sql`AND p.author_id = ${authorId}`
      : Prisma.sql``;

    const searchQuery = Prisma.sql`
      SELECT
        p.*,
        JSON_OBJECT(
          'id', u.id,
          'username', u.username,
          'nick', u.nick,
          'phone', u.phone,
          'address', u.address,
          'role', u.role,
          'email', u.email,
          'email_verified_at', u.email_verified_at,
          'profile_image_url', u.profile_image_url,
          'profile_image_updated_at', u.profile_image_updated_at,
          'deleted_at', u.deleted_at,
          'created_at', u.created_at,
          'updated_at', u.updated_at
        ) as author
      FROM \`post\` p
      INNER JOIN \`user\` u ON p.author_id = u.id
      WHERE p.deleted_at IS NULL
        ${authorCondition}
        ${categoryCondition}
        AND (p.title LIKE ${searchTerm} OR p.content LIKE ${searchTerm})
      ORDER BY p.is_pinned DESC, p.${Prisma.raw(sortField)} ${Prisma.raw(
        sortOrder
      )}, p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = Prisma.sql`
      SELECT COUNT(*) as count
      FROM \`post\` p
      WHERE p.deleted_at IS NULL
        ${authorCondition}
        ${categoryCondition}
        AND (p.title LIKE ${searchTerm} OR p.content LIKE ${searchTerm})
    `;

    const [rawPosts, rawCount] = await Promise.all([
      prisma.$queryRaw<any[]>(searchQuery),
      prisma.$queryRaw<{ count: bigint }[]>(countQuery),
    ]);

    totalCount = Number(rawCount[0].count);

    posts = rawPosts.map((row) => ({
      ...row,
      id: BigInt(row.id),
      is_pinned: Boolean(row.is_pinned),
      author:
        typeof row.author === "string" ? JSON.parse(row.author) : row.author,
    }));
  } else {
    const where: Prisma.postWhereInput = {
      deleted_at: null,
      ...(category && { category }),
      ...(authorId && { author_id: authorId }),
    };

    const [postsResult, totalCountResult] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: [
          { is_pinned: "desc" },
          { [sort]: order },
          { created_at: "desc" },
        ],
        skip: offset,
        take: limit,
        include: { author: true },
      }),
      prisma.post.count({ where }),
    ]);

    posts = postsResult;
    totalCount = totalCountResult;
  }

  const postIds = posts.map((post) => post.id.toString());
  const redisKeys = postIds.map((id) => `post:view:count:${id}`);
  const bufferCounts: (string | null)[] =
    redisKeys.length > 0
      ? await redis
          .mget(...redisKeys)
          .catch(() => new Array(redisKeys.length).fill(null))
      : [];

  // 좋아요 여부 일괄 조회
  const likedPostIds = new Set<string>();
  if (currentUserId !== undefined && postIds.length > 0) {
    const likes = await prisma.post_like.findMany({
      where: {
        user_id: currentUserId,
        post_id: { in: posts.map((p) => p.id) },
      },
      select: { post_id: true },
    });
    likes.forEach((like) => likedPostIds.add(like.post_id.toString()));
  }

  const list = posts.map((post, index) => {
    const bufferCount = parseInt(bufferCounts[index] || "0", 10);
    const totalViewCount = post.view_count + bufferCount;
    const isLiked =
      currentUserId !== undefined
        ? likedPostIds.has(post.id.toString())
        : undefined;

    return toPostResponse(post, totalViewCount, isLiked);
  });

  const totalPages = Math.ceil(totalCount / limit);

  return {
    list,
    totalCount,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/** 게시글 단건을 조회한다. */
export const getPostService = async (
  postId: bigint,
  currentUserId: number | undefined,
  clientIp: string
) => {
  const postIdStr = postId.toString();

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: true,
      post_likes:
        currentUserId !== undefined
          ? {
              where: { user_id: currentUserId },
              take: 1,
            }
          : false,
    },
  });

  if (!post || post.deleted_at) {
    throw new NotFoundError("게시글을 찾을 수 없습니다.");
  }

  const isLiked =
    currentUserId !== undefined && "post_likes" in post
      ? post.post_likes.length > 0
      : undefined;

  const isAuthor = currentUserId && post.author_id === currentUserId;

  let currentViewCount = post.view_count;
  const countKey = `post:view:count:${postIdStr}`;

  // 작성자가 아닌 경우에만 조회수 증가
  if (!isAuthor) {
    const identifier = `ip:${clientIp}`;
    const checkKey = `post:view:check:${postIdStr}:${identifier}`;

    const isAlreadyViewed = await redis.exists(checkKey);

    if (!isAlreadyViewed) {
      try {
        await redis.incr(countKey);
        await redis.setex(checkKey, 24 * 60 * 60, "1");
      } catch (redisError) {
        logger.error("Redis 조회수 증가 실패", { error: redisError });
      }
    }
  }

  // Redis 버퍼 조회는 항상 수행 (작성자도 조회수는 봐야 함)
  try {
    const bufferCount = await redis.get(countKey);
    if (bufferCount) {
      currentViewCount = post.view_count + parseInt(bufferCount, 10);
    }
  } catch (redisError) {
    logger.error("Redis 조회수 조회 실패", { error: redisError });
  }

  return { data: { post: toPostResponse(post, currentViewCount, isLiked) } };
};

/** 게시글을 생성한다. */
export const createPostService = async (params: CreatePostParams) => {
  const { userId, title, content, category, blobUrlMapping, files } = params;
  const uploadedFilePaths: string[] = [];

  try {
    const contentJson = JSON.parse(content);
    const imageUrls = extractImageUrls(contentJson);

    const post = await prisma.$transaction(async (tx) => {
      const newPost = await tx.post.create({
        data: {
          title,
          content: "",
          category,
          author_id: userId,
        },
      });

      const postId = newPost.id.toString();
      const urlMap: Record<string, string> = {};

      for (const blobUrl of imageUrls) {
        if (!blobUrl.startsWith("blob:")) {
          urlMap[blobUrl] = blobUrl;
          continue;
        }

        const fileIndex = blobUrlMapping[blobUrl];
        if (fileIndex === undefined || fileIndex === null) {
          throw new Error(
            `blob URL에 해당하는 파일 인덱스를 찾을 수 없습니다: ${blobUrl}`
          );
        }

        const file = files[fileIndex];
        if (!file) {
          throw new Error(
            `파일 인덱스 ${fileIndex}에 해당하는 파일을 찾을 수 없습니다.`
          );
        }

        const uuid = randomUUID();
        const ext = path.extname(file.originalname);
        const newPath = `post-images/${postId}/${uuid}${ext}`;

        const fileRef = firebaseStorage.file(newPath);

        await fileRef.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
          },
          public: true,
        });

        uploadedFilePaths.push(newPath);

        const newUrl = toPublicUrl(newPath);
        if (!newUrl) {
          throw new Error(`이미지 URL 생성에 실패했습니다: ${newPath}`);
        }

        urlMap[blobUrl] = newUrl;

        await tx.media.create({
          data: {
            entity_type: ENTITY_TYPES.POST,
            entity_id: newPost.id,
            url: newUrl,
            mime_type: file.mimetype,
          },
        });
      }

      const updatedContentJson = updateImageUrlsInContent(contentJson, urlMap);
      const updatedContent = JSON.stringify(updatedContentJson);

      const updatedPost = await tx.post.update({
        where: { id: newPost.id },
        data: { content: updatedContent },
      });

      return updatedPost;
    });

    return { data: { post: toPostResponse(post) } };
  } catch (error) {
    // 트랜잭션 실패 시 Firebase Storage에 업로드된 파일들 정리
    if (uploadedFilePaths.length > 0) {
      logger.warn(
        `트랜잭션 실패로 인해 ${uploadedFilePaths.length}개의 파일을 정리합니다.`
      );
      for (const filePath of uploadedFilePaths) {
        try {
          const fileRef = firebaseStorage.file(filePath);
          const [exists] = await fileRef.exists();
          if (exists) {
            await fileRef.delete();
            logger.info(`정리 완료: ${filePath}`);
          }
        } catch (cleanupError) {
          logger.error(`파일 정리 실패`, { filePath, error: cleanupError });
        }
      }
    }
    throw error;
  }
};

/** 게시글을 수정한다. */
export const updatePostService = async (params: UpdatePostParams) => {
  const { userId, postId, title, content, category, blobUrlMapping, files } =
    params;
  const uploadedFilePaths: string[] = [];

  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
    include: { author: true },
  });

  if (!existingPost) {
    throw new NotFoundError("게시글을 찾을 수 없습니다.");
  }

  if (existingPost.deleted_at) {
    throw new BadRequestError("이미 삭제된 게시글입니다.");
  }

  if (existingPost.author_id !== userId) {
    throw new ForbiddenError("게시글을 수정할 권한이 없습니다.");
  }

  const updateData: {
    title?: string;
    content?: string;
    category?: post_category;
  } = {};

  if (title !== undefined) updateData.title = title;
  if (category !== undefined) updateData.category = category;

  if (content !== undefined) {
    try {
      const contentJson = JSON.parse(content);
      const newImageUrls = extractImageUrls(contentJson);

      const updatedPost = await prisma.$transaction(async (tx) => {
        const existingMedia = await tx.media.findMany({
          where: {
            entity_type: ENTITY_TYPES.POST,
            entity_id: postId,
          },
        });

        const existingImageUrls = existingMedia.map((m) => m.url);

        const unusedImageUrls = existingImageUrls.filter(
          (url) => !newImageUrls.includes(url)
        );

        for (const unusedUrl of unusedImageUrls) {
          await tx.media.deleteMany({
            where: {
              entity_type: ENTITY_TYPES.POST,
              entity_id: postId,
              url: unusedUrl,
            },
          });

          const filePath = extractPathFromUrl(unusedUrl);
          if (filePath) {
            try {
              const fileRef = firebaseStorage.file(filePath);
              const [exists] = await fileRef.exists();
              if (exists) {
                await fileRef.delete();
              }
            } catch (deleteError) {
              logger.error("이미지 삭제 실패", { url: unusedUrl, error: deleteError });
            }
          }
        }

        const urlMap: Record<string, string> = {};

        for (const imageUrl of newImageUrls) {
          if (!imageUrl.startsWith("blob:")) {
            urlMap[imageUrl] = imageUrl;
            continue;
          }

          const fileIndex = blobUrlMapping[imageUrl];
          if (fileIndex === undefined || fileIndex === null) {
            throw new Error(
              `blob URL에 해당하는 파일 인덱스를 찾을 수 없습니다: ${imageUrl}`
            );
          }

          const file = files[fileIndex];
          if (!file) {
            throw new Error(
              `파일 인덱스 ${fileIndex}에 해당하는 파일을 찾을 수 없습니다.`
            );
          }

          const uuid = randomUUID();
          const ext = path.extname(file.originalname);
          const newPath = `post-images/${postId.toString()}/${uuid}${ext}`;

          const fileRef = firebaseStorage.file(newPath);

          await fileRef.save(file.buffer, {
            metadata: {
              contentType: file.mimetype,
            },
            public: true,
          });

          uploadedFilePaths.push(newPath);

          const newUrl = toPublicUrl(newPath);
          if (!newUrl) {
            throw new Error(`이미지 URL 생성에 실패했습니다: ${newPath}`);
          }

          urlMap[imageUrl] = newUrl;

          await tx.media.create({
            data: {
              entity_type: ENTITY_TYPES.POST,
              entity_id: postId,
              url: newUrl,
              mime_type: file.mimetype,
            },
          });
        }

        const updatedContentJson = updateImageUrlsInContent(
          contentJson,
          urlMap
        );
        updateData.content = JSON.stringify(updatedContentJson);

        const updatedPost = await tx.post.update({
          where: { id: postId },
          data: updateData,
          include: { author: true },
        });

        return updatedPost;
      });

      return { data: { post: toPostResponse(updatedPost) } };
    } catch (error) {
      // 트랜잭션 실패 시 Firebase Storage에 업로드된 파일들 정리
      if (uploadedFilePaths.length > 0) {
        logger.warn(
          `트랜잭션 실패로 인해 ${uploadedFilePaths.length}개의 파일을 정리합니다.`
        );
        for (const filePath of uploadedFilePaths) {
          try {
            const fileRef = firebaseStorage.file(filePath);
            const [exists] = await fileRef.exists();
            if (exists) {
              await fileRef.delete();
              logger.info(`정리 완료: ${filePath}`);
            }
          } catch (cleanupError) {
            logger.error("파일 정리 실패", { filePath, error: cleanupError });
          }
        }
      }
      throw error;
    }
  } else {
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: { author: true },
    });

    return { data: { post: toPostResponse(updatedPost) } };
  }
};

/** 게시글을 삭제한다. */
export const deletePostService = async (userId: number, postId: bigint) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError("게시글을 찾을 수 없습니다.");
  }

  if (post.deleted_at) {
    throw new BadRequestError("이미 삭제된 게시글입니다.");
  }

  if (post.author_id !== userId) {
    throw new ForbiddenError("게시글을 삭제할 권한이 없습니다.");
  }

  await prisma.post.update({
    where: { id: postId },
    data: { deleted_at: new Date() },
  });

  return { data: null };
};

/** 여러 게시글을 일괄 삭제한다. */
export const deletePostsService = async (userId: number, ids: string[]) => {
  const success: Array<{ id: string; message: string }> = [];
  const failed: Array<{ id: string; message: string }> = [];

  const postIds = ids.map((idStr) => BigInt(idStr));

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

  const postMap = new Map(posts.map((p) => [p.id.toString(), p]));

  const deletableIds: bigint[] = [];

  for (const idStr of ids) {
    const post = postMap.get(idStr);

    if (!post) {
      failed.push({
        id: idStr,
        message: "게시글을 찾을 수 없습니다.",
      });
      continue;
    }

    if (post.deleted_at) {
      failed.push({
        id: idStr,
        message: "이미 삭제된 게시글입니다.",
      });
      continue;
    }

    if (post.author_id !== userId) {
      failed.push({
        id: idStr,
        message: "게시글을 삭제할 권한이 없습니다.",
      });
      continue;
    }

    deletableIds.push(BigInt(idStr));
  }

  if (deletableIds.length > 0) {
    await prisma.post.updateMany({
      where: {
        id: { in: deletableIds },
      },
      data: {
        deleted_at: new Date(),
      },
    });

    for (const id of deletableIds) {
      success.push({
        id: id.toString(),
        message: "게시글이 삭제되었습니다.",
      });
    }
  }

  return { data: { success, failed } };
};

/** 게시글 좋아요를 토글한다. */
export const togglePostLikeService = async (userId: number, postId: bigint) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError("게시글을 찾을 수 없습니다.");
  }

  if (post.deleted_at) {
    throw new BadRequestError("삭제된 게시글에는 좋아요를 할 수 없습니다.");
  }

  const existingLike = await prisma.post_like.findUnique({
    where: {
      post_id_user_id: {
        post_id: postId,
        user_id: userId,
      },
    },
  });

  const result = await prisma.$transaction(async (tx) => {
    if (existingLike) {
      await tx.post_like.delete({
        where: {
          post_id_user_id: {
            post_id: postId,
            user_id: userId,
          },
        },
      });

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
      await tx.post_like.create({
        data: {
          post_id: postId,
          user_id: userId,
        },
      });

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

  return { data: result };
};

/** 여러 게시글의 좋아요를 일괄 취소한다. */
export const togglePostLikesService = async (userId: number, ids: string[]) => {
  const success: Array<{ id: string; message: string }> = [];
  const failed: Array<{ id: string; message: string }> = [];

  const postIds = ids.map((idStr) => BigInt(idStr));

  const existingLikes = await prisma.post_like.findMany({
    where: {
      post_id: { in: postIds },
      user_id: userId,
    },
    select: {
      post_id: true,
    },
  });

  const likedPostIds = new Set(
    existingLikes.map((like) => like.post_id.toString())
  );

  const togglableIds: bigint[] = [];

  for (const idStr of ids) {
    if (!likedPostIds.has(idStr)) {
      failed.push({
        id: idStr,
        message: "좋아요가 존재하지 않습니다.",
      });
      continue;
    }

    togglableIds.push(BigInt(idStr));
  }

  if (togglableIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.post_like.deleteMany({
        where: {
          post_id: { in: togglableIds },
          user_id: userId,
        },
      });

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

    for (const id of togglableIds) {
      success.push({
        id: id.toString(),
        message: "좋아요가 취소되었습니다.",
      });
    }
  }

  return { data: { success, failed } };
};

/** 내가 좋아요한 게시글 목록을 조회한다. */
export const getMyLikedPostListService = async (
  userId: number,
  page: number,
  limit: number,
  order: "asc" | "desc"
) => {
  const offset = (page - 1) * limit;
  const sortOrder = order?.toLowerCase() === "asc" ? "asc" : "desc";

  const [likes, totalCount] = await Promise.all([
    prisma.post_like.findMany({
      where: {
        user_id: userId,
        post: {
          deleted_at: null,
        },
      },
      orderBy: { created_at: sortOrder },
      skip: offset,
      take: limit,
      select: { post_id: true },
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

  if (likes.length === 0) {
    const totalPages = Math.ceil(totalCount / limit);
    return {
      data: {
        list: [],
        totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  const postIds = likes.map((like) => like.post_id);

  const posts = await prisma.post.findMany({
    where: {
      id: { in: postIds },
      deleted_at: null,
    },
    include: { author: true },
  });

  const postsMap = new Map(posts.map((post) => [post.id.toString(), post]));
  const orderedPosts = postIds
    .map((id) => postsMap.get(id.toString()))
    .filter((post): post is (typeof posts)[0] => post !== undefined);

  const postIdStrings = orderedPosts.map((post) => post.id.toString());
  const redisKeys = postIdStrings.map((id) => `post:view:count:${id}`);
  const bufferCounts: (string | null)[] =
    redisKeys.length > 0
      ? await redis
          .mget(...redisKeys)
          .catch(() => new Array(redisKeys.length).fill(null))
      : [];

  const list = orderedPosts.map((post, index) => {
    const bufferCount = parseInt(bufferCounts[index] || "0", 10);
    const totalViewCount = post.view_count + bufferCount;
    return toPostResponse(post, totalViewCount, true);
  });

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: {
      list,
      totalCount,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};
