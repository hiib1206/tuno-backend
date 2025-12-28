import { NextFunction, Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { z, ZodError } from "zod";
import { sendError } from "../utils/commonResponse";
import { formatZodError } from "../utils/zod";

interface SchemaSet {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

/**
 * 검증 미들웨어 구성 설명:
 * 통합 검증 미들웨어. 모든 검증 로직을 한 곳에서 관리할 수 있도록 설계되어 있습니다.
 * 사용 예시 : validate({ body: 스키마 });
 * 파싱에 실패(ZodError 발생)하면 400 상태코드와 상세 오류 메시지를 반환합니다.
 * 모든 유효성 검사가 통과하면 req 객체의 값을 파싱 결과로 교체하고, 다음 미들웨어로 흐름을 넘깁니다.
 */

export const validateMiddleware =
  (schemas: SchemaSet) => (req: Request, res: Response, next: NextFunction) => {
    try {
      // validated 객체 초기화
      req.validated = {};

      if (schemas.body) {
        const parsedBody = schemas.body.parse(req.body);
        req.body = parsedBody; // 기존 방식 유지
        req.validated.body = parsedBody; // 새로운 방식도 제공
      }

      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);

        // 1. 기존 query 객체의 모든 속성 제거 (Reference 유지)
        Object.keys(req.query).forEach((key) => {
          delete (req.query as any)[key];
        });
        // 2. 검증 및 변환(Transform)된 값만 주입 (기존 방식 유지)
        Object.assign(req.query, parsedQuery);
        req.validated.query = parsedQuery; // 새로운 방식도 제공
      }

      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params);
        req.params = parsedParams as ParamsDictionary; // 기존 방식 유지
        req.validated.params = parsedParams; // 새로운 방식도 제공
      }

      next();
    } catch (err) {
      console.log("validateMiddleware 에러 발생:", err);
      if (err instanceof ZodError) {
        const formattedErrors = formatZodError(err);
        return sendError(res, 400, formattedErrors);
      }
      // ZodError 외의 에러는 다음 미들웨어로 흐름을 넘깁니다(errorHandler에서 처리)
      next(err);
    }
  };
