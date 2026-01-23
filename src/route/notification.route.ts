import { Router } from "express";
import {
  getNotificationList,
  getUnreadCount,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  streamNotifications,
} from "../controller/notification.controller";
import { verifyAccessTokenMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  getNotificationListSchema,
  notificationIdParamSchema,
  markNotificationsReadSchema,
} from "../schema/notification.schema";

const notificationRouter = Router();

// GET /api/notification/stream (SSE 연결 - 다른 라우트보다 위에 배치)
notificationRouter.get(
  "/stream",
  verifyAccessTokenMiddleware,
  streamNotifications
);

// GET /api/notification/unread-count (안읽은 개수)
notificationRouter.get(
  "/unread-count",
  verifyAccessTokenMiddleware,
  getUnreadCount
);

// PATCH /api/notification/read-all (전체 읽음 - :id 라우트보다 위에 배치)
notificationRouter.patch(
  "/read-all",
  verifyAccessTokenMiddleware,
  markAllAsRead
);

// PATCH /api/notification/read (여러 개 읽음)
notificationRouter.patch(
  "/read",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: markNotificationsReadSchema }),
  markMultipleAsRead
);

// GET /api/notification (알림 목록)
notificationRouter.get(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: getNotificationListSchema }),
  getNotificationList
);

// PATCH /api/notification/:id/read (단건 읽음)
notificationRouter.patch(
  "/:id/read",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: notificationIdParamSchema }),
  markAsRead
);

export default notificationRouter;
