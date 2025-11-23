import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { sendError } from "../utils/response";
import { ParsedQs } from "qs";
import { ParamsDictionary } from "express-serve-static-core";
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
      if (schemas.body) req.body = schemas.body.parse(req.body) as any;
      if (schemas.query) req.query = schemas.query.parse(req.query) as ParsedQs;
      if (schemas.params)
        req.params = schemas.params.parse(req.params) as ParamsDictionary;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const formattedErrors = "[유효성 검사 실패]\n" + formatZodError(err);
        return sendError(res, 400, formattedErrors);
      }
      // ZodError 외의 에러는 다음 미들웨어로 흐름을 넘깁니다(errorHandler에서 처리)
      next(err);
    }
  };
