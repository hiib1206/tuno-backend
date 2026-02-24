import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { generateOpenAPIDocument } from "./generator";

/**
 * Swagger UI를 Express 앱에 연결한다.
 */
export function setupSwagger(app: Express) {
  // 운영 환경에서는 Swagger UI 비활성화
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const doc = generateOpenAPIDocument();

  // Swagger UI
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(doc, {
      customSiteTitle: "Tuno API Docs",
      swaggerOptions: {
        tryItOutEnabled: true,
        displayRequestDuration: true,
        filter: true,
        persistAuthorization: true,
      },
    })
  );

  // Raw JSON 스펙 (SDK 생성, CI/CD 용)
  app.get("/openapi.json", (_req, res) => {
    res.json(doc);
  });
}
