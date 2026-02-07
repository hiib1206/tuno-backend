import prisma from "../config/prisma";
import redis from "../config/redis";
import { Prisma } from "../generated/prisma/client";
import { GetPostListSchema } from "../schema/post.schema";
import { toPostResponse } from "../utils/post";

interface GetPostListParams extends GetPostListSchema {
  authorId?: number; // 작성자 필터링 (옵셔널)
  currentUserId?: number; // 좋아요 여부 확인용 (옵셔널)
}

interface PostListResult {
  list: any[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const getPostListService = async (
  params: GetPostListParams
): Promise<PostListResult> => {
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

  // 정렬/순서 보안 처리
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
    // LIKE 검색 사용 (한글 부분 검색 지원)
    const searchTerm = `%${search.trim()}%`;
    const categoryCondition = category
      ? Prisma.sql`AND p.category = ${category}`
      : Prisma.sql``;

    // 작성자 필터 조건 추가
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
    // 검색어가 없는 경우
    const where: Prisma.postWhereInput = {
      deleted_at: null,
      ...(category && { category }),
      ...(authorId && { author_id: authorId }), // 작성자 필터 추가
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

  // Redis 조회수 합산
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

  // 최종 응답 매핑
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
