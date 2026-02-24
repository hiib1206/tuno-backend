import { z } from "zod";

/**
 * 사용자 역할
 */
export const userRoleSchema = z
  .enum(["FREE", "PREMIUM", "ADMIN"])
  .openapi({
    description: "사용자 역할",
    example: "FREE",
  });

/**
 * 사용자 응답 스키마
 *
 * @remarks
 * toUserResponse()가 반환하는 구조와 동일하게 유지해야 한다.
 * camelCase로 변환되어 응답되므로 camelCase로 정의한다.
 */
export const userResponseSchema = z
  .object({
    id: z.number().openapi({
      description: "사용자 ID",
      example: 1,
    }),
    username: z.string().nullable().openapi({
      description: "아이디 (소셜 로그인의 경우 null)",
      example: "testuser",
    }),
    nick: z.string().openapi({
      description: "닉네임",
      example: "테스트유저",
    }),
    email: z.string().nullable().openapi({
      description: "이메일 주소",
      example: "user@example.com",
    }),
    phone: z.string().nullable().openapi({
      description: "전화번호",
      example: "010-1234-5678",
    }),
    address: z.string().nullable().openapi({
      description: "주소",
      example: "서울시 강남구",
    }),
    role: userRoleSchema,
    profileImageUrl: z.string().nullable().openapi({
      description: "프로필 이미지 URL",
      example: "https://storage.example.com/profile/1.jpg",
    }),
    emailVerifiedAt: z.string().datetime().nullable().openapi({
      description: "이메일 인증 일시",
      example: "2025-01-15T09:30:00Z",
    }),
    profileImageUpdatedAt: z.string().datetime().nullable().openapi({
      description: "프로필 이미지 수정 일시",
      example: "2025-01-15T09:30:00Z",
    }),
    createdAt: z.string().datetime().openapi({
      description: "가입 일시",
      example: "2025-01-15T09:30:00Z",
    }),
    updatedAt: z.string().datetime().openapi({
      description: "정보 수정 일시",
      example: "2025-01-15T09:30:00Z",
    }),
    authProviders: z
      .array(
        z.object({
          provider: z.string().openapi({
            description: "인증 제공자",
            example: "google",
          }),
          createdAt: z.string().datetime().openapi({
            description: "연결 일시",
            example: "2025-01-15T09:30:00Z",
          }),
        })
      )
      .optional()
      .openapi({
        description: "연결된 소셜 로그인 정보",
      }),
  })
  .openapi("UserResponse");

export type UserResponse = z.infer<typeof userResponseSchema>;
