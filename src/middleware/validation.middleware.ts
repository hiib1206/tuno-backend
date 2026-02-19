import { NextFunction, Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { z, ZodError } from "zod";
import { ValidationError } from "../shared/errors/AppError";
import { formatZodError } from "../shared/utils/zod";

interface SchemaSet {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

/**
 * body, query, params를 Zod 스키마로 검증하고 파싱된 값으로 교체한다.
 *
 * @param schemas - 검증할 스키마 객체
 * @throws {@link ValidationError} Zod 파싱 실패 시
 *
 * @example
 * ```ts
 * router.post("/users", validateMiddleware({ body: createUserSchema }), controller)
 * ```
 */
export const validateMiddleware =
  (schemas: SchemaSet) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.validated = {};

      if (schemas.body) {
        const parsedBody = schemas.body.parse(req.body);
        req.body = parsedBody;
        req.validated.body = parsedBody;
      }

      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);

        // req.query 참조를 유지하면서 값만 교체 (Express 내부에서 참조를 사용하는 경우 대비)
        Object.keys(req.query).forEach((key) => {
          delete (req.query as any)[key];
        });
        Object.assign(req.query, parsedQuery);
        req.validated.query = parsedQuery;
      }

      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params);
        req.params = parsedParams as ParamsDictionary;
        req.validated.params = parsedParams;
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(formatZodError(err));
      }
      next(err);
    }
  };
