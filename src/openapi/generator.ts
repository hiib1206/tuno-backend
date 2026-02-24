import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { env } from "../config/env";
import { registry } from "./registry";

/**
 * OpenAPI 문서를 생성한다.
 */
export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Tuno API",
      version: "1.0.0",
      description: "Tuno 백엔드 API 문서",
    },
    servers: [
      { url: `http://localhost:${env.BACKEND_PORT}`, description: "개발 서버" },
    ],
  });
}
