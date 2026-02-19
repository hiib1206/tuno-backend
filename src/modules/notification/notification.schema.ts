import { z } from "zod";

// 알림 목록 조회 스키마 (쿼리 파라미터) - 커서 기반 페이지네이션
export const getNotificationListSchema = z.object({
  cursor: z
    .string()
    .regex(/^\d+$/, "커서는 숫자여야 합니다.")
    .optional(),

  limit: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === "") return 20;
      if (typeof val === "string") return parseInt(val, 10);
      if (typeof val === "number") return val;
      return 20;
    }, z.number().int().min(1).max(50).default(20))
    .default(20),
});

export type GetNotificationListSchema = z.infer<typeof getNotificationListSchema>;

// 단건 읽음 처리 - 파라미터 검증
export const notificationIdParamSchema = z.object({
  id: z
    .string()
    .min(1, "알림 ID를 입력해주세요.")
    .regex(/^\d+$/, "알림 ID는 숫자여야 합니다."),
});

export type NotificationIdParamSchema = z.infer<typeof notificationIdParamSchema>;

// 여러 알림 읽음 처리 (Body에 ID 배열)
export const markNotificationsReadSchema = z.object({
  ids: z
    .array(z.string().regex(/^\d+$/, "알림 ID는 숫자여야 합니다."))
    .min(1, "최소 1개 이상의 알림 ID를 입력해주세요."),
});

export type MarkNotificationsReadSchema = z.infer<typeof markNotificationsReadSchema>;
