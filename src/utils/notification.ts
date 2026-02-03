import { notification_type } from "../generated/prisma/enums";
import { toPublicUrl } from "./firebase";

// Prisma enum 재export (다른 파일에서 편하게 import하도록)
export { notification_type };

// SSE 이벤트 이름 상수
export const SSEEvent = {
  NOTIFICATION_CREATED: "notification.created",
} as const;

// 알림 + actor 정보 포함된 타입
interface NotificationWithActor {
  id: bigint;
  user_id: number;
  actor_id: number | null;
  type: notification_type;
  data: unknown;
  read_at: Date | null;
  created_at: Date;
  actor?: {
    id: number;
    username: string | null;
    nick: string;
    profile_image_url: string | null;
  } | null;
}

/**
 * Notification 객체를 응답용으로 변환
 * - id를 string으로 변환 (BigInt 처리)
 * - actor 정보 포함
 */
export const toNotificationResponse = (notification: NotificationWithActor) => {
  return {
    id: notification.id.toString(),
    type: notification.type,
    data: notification.data,
    readAt: notification.read_at,
    createdAt: notification.created_at,
    actor: notification.actor
      ? {
        id: notification.actor.id.toString(),
        username: notification.actor.username,
        nick: notification.actor.nick,
        profileImageUrl: toPublicUrl(notification.actor.profile_image_url),
      }
      : null,
  };
};
