import { z } from "zod";
import dotenv from "dotenv";
import { formatZodError } from "../utils/zod";

dotenv.config();

// 환경변수 스키마 정의
const envSchema = z.object({
  // 여기에 검증 할거 추가.
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().min(1000).max(65535),
});

// 환경변수 검증 및 타입 추론
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

// 검증된 환경변수 export
export const env = validateEnv();
