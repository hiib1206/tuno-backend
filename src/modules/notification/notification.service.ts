import prisma from "../../config/prisma";
import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError";

// 작성자 select 공통 옵션
const actorSelect = {
  id: true,
  username: true,
  nick: true,
  profile_image_url: true,
};

/** 알림 목록을 조회한다. */
export const getNotificationListService = async (
  userId: number,
  cursor: string | undefined,
  limit: number
) => {
  const notifications = await prisma.notification.findMany({
    where: {
      user_id: userId,
      ...(cursor && { id: { lt: BigInt(cursor) } }),
    },
    include: {
      actor: {
        select: actorSelect,
      },
    },
    orderBy: { created_at: "desc" },
    take: limit + 1, // 다음 페이지 존재 여부 확인용
  });

  const hasNext = notifications.length > limit;
  const list = hasNext ? notifications.slice(0, limit) : notifications;
  const nextCursor = hasNext ? list[list.length - 1].id.toString() : null;

  return { list, nextCursor, hasNext };
};

/** 안 읽은 알림 개수를 조회한다. */
export const getUnreadCountService = async (userId: number) => {
  const count = await prisma.notification.count({
    where: {
      user_id: userId,
      read_at: null,
    },
  });

  return { count };
};

/** 단건 알림을 읽음 처리한다. */
export const markAsReadService = async (userId: number, notificationId: bigint) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotFoundError("알림을 찾을 수 없습니다.");
  }

  if (notification.user_id !== userId) {
    throw new ForbiddenError("알림을 읽을 권한이 없습니다.");
  }

  if (notification.read_at) {
    return { alreadyRead: true };
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { read_at: new Date() },
  });

  return { alreadyRead: false };
};

/** 여러 알림을 읽음 처리한다. */
export const markMultipleAsReadService = async (userId: number, ids: string[]) => {
  const notificationIds = ids.map((id) => BigInt(id));

  const result = await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      user_id: userId,
      read_at: null,
    },
    data: { read_at: new Date() },
  });

  return { updatedCount: result.count };
};

/** 모든 알림을 읽음 처리한다. */
export const markAllAsReadService = async (userId: number) => {
  const result = await prisma.notification.updateMany({
    where: {
      user_id: userId,
      read_at: null,
    },
    data: { read_at: new Date() },
  });

  return { updatedCount: result.count };
};
