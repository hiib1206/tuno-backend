import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Zod에 .openapi() 메서드 추가 (프로젝트에서 1회만 호출)
extendZodWithOpenApi(z);

// Registry 싱글턴 - 모든 도메인에서 이걸 import해서 사용
export const registry = new OpenAPIRegistry();

// Bearer JWT 인증 스키마 등록
registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "JWT 액세스 토큰을 Authorization 헤더에 포함하세요.",
});
