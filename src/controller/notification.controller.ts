import { NextFunction, Request, Response } from "express";
import prisma from "../config/prisma";
import {
  GetNotificationListSchema,
  MarkNotificationsReadSchema,
} from "../schema/notification.schema";
import { sendError, sendSuccess } from "../utils/commonResponse";
import { toNotificationResponse } from "../utils/notification";
import { UserPayload } from "../utils/token";
import { addConnection, removeConnection } from "../service/sse.service";

/**
 * 알림 목록 조회 (커서 기반 페이지네이션)
 * GET /api/notification
 */
export const getNotificationList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { cursor, limit } = req.validated?.query as GetNotificationListSchema;

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: userId,
        ...(cursor && { id: { lt: BigInt(cursor) } }),
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            nick: true,
            profile_image_url: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      take: limit + 1, // 다음 페이지 존재 여부 확인용
    });

    const hasNext = notifications.length > limit;
    const list = hasNext ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasNext ? list[list.length - 1].id.toString() : null;

    return sendSuccess(res, 200, "알림 목록을 조회했습니다.", {
      list: list.map(toNotificationResponse),
      nextCursor,
      hasNext,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 안 읽은 알림 개수 조회
 * GET /api/notification/unread-count
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;

    const count = await prisma.notification.count({
      where: {
        user_id: userId,
        read_at: null,
      },
    });

    return sendSuccess(res, 200, "안 읽은 알림 개수를 조회했습니다.", {
      count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 단건 읽음 처리
 * PATCH /api/notification/:id/read
 */
export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const notificationId = BigInt(req.params.id);

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return sendError(res, 404, "알림을 찾을 수 없습니다.");
    }

    if (notification.user_id !== userId) {
      return sendError(res, 403, "알림을 읽을 권한이 없습니다.");
    }

    if (notification.read_at) {
      return sendSuccess(res, 200, "이미 읽은 알림입니다.");
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { read_at: new Date() },
    });

    return sendSuccess(res, 200, "알림을 읽음 처리했습니다.");
  } catch (error) {
    next(error);
  }
};

/**
 * 여러 알림 읽음 처리
 * PATCH /api/notification/read
 */
export const markMultipleAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { ids } = req.validated?.body as MarkNotificationsReadSchema;

    const notificationIds = ids.map((id) => BigInt(id));

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        user_id: userId,
        read_at: null,
      },
      data: { read_at: new Date() },
    });

    return sendSuccess(res, 200, "알림을 읽음 처리했습니다.", {
      updatedCount: result.count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 전체 읽음 처리
 * PATCH /api/notification/read-all
 */
export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;

    const result = await prisma.notification.updateMany({
      where: {
        user_id: userId,
        read_at: null,
      },
      data: { read_at: new Date() },
    });

    return sendSuccess(res, 200, "모든 알림을 읽음 처리했습니다.", {
      updatedCount: result.count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * SSE 스트림 연결
 * GET /api/notification/stream
 */
export const streamNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const userIdStr = userId.toString();

    // SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // nginx 버퍼링 비활성화

    // 연결 성공 메시지
    res.write(`event: connected\ndata: ${JSON.stringify({ message: "SSE 연결됨" })}\n\n`);

    // 연결 등록
    addConnection(userIdStr, res);

    // 30초마다 keep-alive (연결 유지)
    const keepAlive = setInterval(() => {
      res.write(`: keep-alive\n\n`);
    }, 30000);

    // 연결 종료 시 정리
    req.on("close", () => {
      clearInterval(keepAlive);
      removeConnection(userIdStr, res);
    });
  } catch (error) {
    next(error);
  }
};
