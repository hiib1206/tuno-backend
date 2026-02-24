import express, { ErrorRequestHandler } from "express";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import request from "supertest";
// Zod OpenAPI 확장 (스키마 import 전에 필요)
import { validateMiddleware } from "../../src/middleware/validation.middleware";
import { loginSchema, registerSchema } from "../../src/modules/auth/auth.schema";
import "../../src/openapi/registry";
import { AppError } from "../../src/shared/errors/AppError";

describe("Auth API 유효성 검사", () => {
  let app: express.Express;

  before(() => {
    app = express();
    app.use(express.json());

    // 테스트용 라우트 (validation만 테스트, 실제 로직은 없음)
    app.post(
      "/api/auth/login",
      validateMiddleware({ body: loginSchema }),
      (_req, res) => res.json({ success: true })
    );

    app.post(
      "/api/auth/register",
      validateMiddleware({ body: registerSchema }),
      (_req, res) => res.status(201).json({ success: true })
    );

    // 테스트용 에러 핸들러
    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
        });
      }
      return res.status(500).json({ success: false, message: "Internal error" });
    };

    app.use(errorHandler);
  });

  describe("POST /api/auth/login", () => {
    it("빈 body를 보내면 400을 반환한다", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({})
        .expect("Content-Type", /json/)
        .expect(400);

      assert.equal(res.body.success, false);
    });

    it("username이 없으면 400을 반환한다", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ pw: "password123" })
        .expect(400);

      assert.equal(res.body.success, false);
    });

    it("pw가 없으면 400을 반환한다", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "testuser" })
        .expect(400);

      assert.equal(res.body.success, false);
    });

    it("유효한 데이터를 보내면 200을 반환한다", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "testuser", pw: "Password123!" })
        .expect(200);

      assert.equal(res.body.success, true);
    });
  });

  describe("POST /api/auth/register", () => {
    it("이메일 형식이 잘못되면 400을 반환한다", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          pw: "Password123!",
          nick: "테스트",
          email: "not-an-email",
          signupToken: "550e8400-e29b-41d4-a716-446655440000",
        })
        .expect(400);

      assert.equal(res.body.success, false);
    });

    it("비밀번호 규칙 위반 시 400을 반환한다", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          pw: "weak", // 8자 미만, 특수문자/숫자 없음
          nick: "테스트",
          email: "test@example.com",
          signupToken: "550e8400-e29b-41d4-a716-446655440000",
        })
        .expect(400);

      assert.equal(res.body.success, false);
    });

    it("유효한 데이터를 보내면 201을 반환한다", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          pw: "Password123!",
          nick: "테스트유저",
          email: "test@example.com",
          signupToken: "550e8400-e29b-41d4-a716-446655440000",
        })
        .expect(201);

      assert.equal(res.body.success, true);
    });
  });
});
