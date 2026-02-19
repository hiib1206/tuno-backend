import { Router } from "express";
import {
  getNotificationList,
  getUnreadCount,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  streamNotifications,
} from "./notification.controller";
import { verifyAccessTokenMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validation.middleware";
import {
  getNotificationListSchema,
  notificationIdParamSchema,
  markNotificationsReadSchema,
} from "./notification.schema";

const notificationRouter = Router();

notificationRouter.get(
  "/stream",
  verifyAccessTokenMiddleware,
  streamNotifications
);

notificationRouter.get(
  "/unread-count",
  verifyAccessTokenMiddleware,
  getUnreadCount
);

notificationRouter.patch(
  "/read-all",
  verifyAccessTokenMiddleware,
  markAllAsRead
);

notificationRouter.patch(
  "/read",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: markNotificationsReadSchema }),
  markMultipleAsRead
);

notificationRouter.get(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: getNotificationListSchema }),
  getNotificationList
);

notificationRouter.patch(
  "/:id/read",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: notificationIdParamSchema }),
  markAsRead
);

export default notificationRouter;
