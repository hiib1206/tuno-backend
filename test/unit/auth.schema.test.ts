import { describe, it } from "node:test";
import assert from "node:assert/strict";
// Zod OpenAPI 확장 (스키마 import 전에 필요)
import "../../src/openapi/registry";
import { passwordSchema, loginSchema } from "../../src/modules/auth/auth.schema";

describe("passwordSchema", () => {
  it("유효한 비밀번호는 통과한다", () => {
    const result = passwordSchema.safeParse("Password123!");
    assert.equal(result.success, true);
  });

  it("8자 미만이면 실패한다", () => {
    const result = passwordSchema.safeParse("Pass1!");
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.message.includes("8자")));
    }
  });

  it("영문이 없으면 실패한다", () => {
    const result = passwordSchema.safeParse("12345678!");
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.message.includes("영문")));
    }
  });

  it("숫자가 없으면 실패한다", () => {
    const result = passwordSchema.safeParse("Password!");
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.message.includes("숫자")));
    }
  });

  it("특수문자가 없으면 실패한다", () => {
    const result = passwordSchema.safeParse("Password123");
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.message.includes("특수문자")));
    }
  });
});

describe("loginSchema", () => {
  it("유효한 로그인 데이터는 통과한다", () => {
    const result = loginSchema.safeParse({
      username: "testuser",
      pw: "Password123!",
    });
    assert.equal(result.success, true);
  });

  it("username이 비어있으면 실패한다", () => {
    const result = loginSchema.safeParse({
      username: "",
      pw: "Password123!",
    });
    assert.equal(result.success, false);
  });

  it("pw가 비어있으면 실패한다", () => {
    const result = loginSchema.safeParse({
      username: "testuser",
      pw: "",
    });
    assert.equal(result.success, false);
  });
});
