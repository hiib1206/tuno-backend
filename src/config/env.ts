import dotenv from "dotenv";
import { z } from "zod";
import { formatZodError } from "../shared/utils/zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  BACKEND_PORT: z.coerce.number().min(1000).max(65535),
  BACKEND_URL: z.string().url(),
  FRONTEND_URL: z.string().min(1),

  // tuno-ai-api-server
  TUNO_AI_API_BASE_URL: z.string().min(1),
  TUNO_AI_API_SECRET_KEY: z.string().min(1),

  // database
  DATABASE_URL: z.string().min(1),
  // redis
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().min(1000).max(65535),
  REDIS_PASSWORD: z.string().min(1).optional(),

  // token
  ACCESS_TOKEN_SECRET: z.string().min(64),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(1),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1),

  // resend
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.email(),
  RESEND_FROM_NAME: z.string().optional(),
  EMAIL_CODE_EXPIRES_IN: z.coerce.number().min(1),

  // firebase
  FIREBASE_CREDENTIAL: z.string().min(1),
  FIREBASE_STORAGE_BUCKET: z.string().min(1),

  // Google OAuth Client
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // Naver OAuth Client
  NAVER_CLIENT_ID: z.string().min(1),
  NAVER_CLIENT_SECRET: z.string().min(1),
  // Kakao OAuth Client
  KAKAO_CLIENT_ID: z.string().min(1),
  KAKAO_CLIENT_SECRET: z.string().min(1),

  // LS증권 API
  LS_APP_KEY: z.string().min(1),
  LS_SECRET_KEY: z.string().min(1),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ 환경변수 검증 실패:");
      console.error(formatZodError(error));
      process.exit(1);
    }
    throw error;
  }
}

/** Zod로 검증된 환경변수 객체. */
export const env = validateEnv();
