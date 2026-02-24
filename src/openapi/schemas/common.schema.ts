import { z } from "zod";

/**
 * 성공 응답 (data 없음)
 *
 * @example
 * { success: true, message: "회원가입이 완료되었습니다." }
 */
export const SuccessResponseSchema = z
  .object({
    success: z.literal(true).openapi({
      description: "요청 성공 여부",
      example: true,
    }),
    message: z.string().openapi({
      description: "응답 메시지",
      example: "요청이 성공적으로 처리되었습니다.",
    }),
  })
  .openapi("SuccessResponse");

/**
 * 성공 응답 (data 포함) 생성 헬퍼
 *
 * @example
 * const LoginResponseSchema = createDataResponseSchema(
 *   z.object({ accessToken: z.string() }),
 *   "LoginResponse"
 * );
 */
export function createDataResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  name: string
) {
  return z
    .object({
      success: z.literal(true).openapi({
        description: "요청 성공 여부",
        example: true,
      }),
      message: z.string().openapi({
        description: "응답 메시지",
        example: "요청이 성공적으로 처리되었습니다.",
      }),
      data: dataSchema,
    })
    .openapi(name);
}

/**
 * 에러 응답
 *
 * @example
 * { success: false, message: "잘못된 요청입니다." }
 */
export const ErrorResponseSchema = z
  .object({
    success: z.literal(false).openapi({
      description: "요청 성공 여부",
      example: false,
    }),
    message: z.string().openapi({
      description: "에러 메시지",
      example: "잘못된 요청입니다.",
    }),
  })
  .openapi("ErrorResponse");

/**
 * 유효성 검사 에러 응답
 *
 * @example
 * { success: false, message: "유효성 검사에 실패했습니다.", details: [...] }
 */
export const ValidationErrorResponseSchema = z
  .object({
    success: z.literal(false).openapi({
      description: "요청 성공 여부",
      example: false,
    }),
    message: z.string().openapi({
      description: "에러 메시지",
      example: "유효성 검사에 실패했습니다.",
    }),
    details: z
      .array(
        z.object({
          field: z.string().openapi({ example: "email" }),
          message: z.string().openapi({ example: "올바른 이메일 형식이 아닙니다." }),
        })
      )
      .openapi({
        description: "필드별 에러 상세",
      }),
  })
  .openapi("ValidationErrorResponse");
