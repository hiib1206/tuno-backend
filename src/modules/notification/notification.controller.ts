import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/commonResponse";
import { UserPayload } from "../../shared/utils/token";
import { addConnection, removeConnection } from "../../shared/utils/sse-manager";
import {
  GetNotificationListSchema,
  MarkNotificationsReadSchema,
} from "./notification.schema";
import {
  getNotificationListService,
  getUnreadCountService,
  markAsReadService,
  markMultipleAsReadService,
  markAllAsReadService,
} from "./notification.service";
import { toNotificationResponse } from "./notification.utils";

/** 알림 목록을 조회한다. */
export const getNotificationList = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { cursor, limit } = req.validated?.query as GetNotificationListSchema;

  const result = await getNotificationListService(userId, cursor, limit);

  return sendSuccess(res, 200, "알림 목록을 조회했습니다.", {
    list: result.list.map(toNotificationResponse),
    nextCursor: result.nextCursor,
    hasNext: result.hasNext,
  });
};

/** 안 읽은 알림 개수를 조회한다. */
export const getUnreadCount = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;

  const result = await getUnreadCountService(userId);

  return sendSuccess(res, 200, "안 읽은 알림 개수를 조회했습니다.", {
    count: result.count,
  });
};

/** 단건 알림을 읽음 처리한다. */
export const markAsRead = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const notificationId = BigInt(req.params.id);

  const result = await markAsReadService(userId, notificationId);

  if (result.alreadyRead) {
    return sendSuccess(res, 200, "이미 읽은 알림입니다.");
  }

  return sendSuccess(res, 200, "알림을 읽음 처리했습니다.");
};

/** 여러 알림을 읽음 처리한다. */
export const markMultipleAsRead = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { ids } = req.validated?.body as MarkNotificationsReadSchema;

  const result = await markMultipleAsReadService(userId, ids);

  return sendSuccess(res, 200, "알림을 읽음 처리했습니다.", {
    updatedCount: result.updatedCount,
  });
};

/** 모든 알림을 읽음 처리한다. */
export const markAllAsRead = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;

  const result = await markAllAsReadService(userId);

  return sendSuccess(res, 200, "모든 알림을 읽음 처리했습니다.", {
    updatedCount: result.updatedCount,
  });
};

/** SSE 스트림에 연결한다. */
export const streamNotifications = async (req: Request, res: Response) => {
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
};
