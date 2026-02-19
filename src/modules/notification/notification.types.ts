// 알림 data 타입 정의

// COMMENT - 내 글에 댓글
export type CommentNotificationData = {
  postId: string;
  commentId: string;
  preview: string;
};

// REPLY - 내 댓글에 대댓글
export type ReplyNotificationData = {
  postId: string;
  commentId: string;
  replyId: string;
  preview: string;
};

// AI_INFERENCE_COMPLETE - AI 추론 완료
export type AiInferenceNotificationData = {
  // TODO: AI 추론 알림 구현 시 정의
};

// SYSTEM_NOTICE - 시스템 공지
export type SystemNoticeNotificationData = {
  noticeId: string;
  title: string;
};

// 타입별 data 매핑
export type NotificationDataMap = {
  COMMENT: CommentNotificationData;
  REPLY: ReplyNotificationData;
  AI_INFERENCE_COMPLETE: AiInferenceNotificationData;
  SYSTEM_NOTICE: SystemNoticeNotificationData;
};
