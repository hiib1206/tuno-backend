import { NextFunction, Request, Response } from "express";
import { user_role } from "../generated/prisma/enums";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../shared/errors/AppError";
import { getUserRole } from "../shared/utils/role";
import { UserPayload } from "../shared/utils/token";

/**
 * 역할 기반 접근 제어 미들웨어 팩토리.
 *
 * @remarks
 * verifyAccessTokenMiddleware 이후에 사용해야 한다.
 *
 * @param allowedRoles - 접근을 허용할 역할 목록
 * @returns Express 미들웨어 함수
 * @throws {@link UnauthorizedError} 인증 정보가 없거나 사용자를 찾을 수 없는 경우
 * @throws {@link ForbiddenError} 허용된 역할이 아닌 경우
 *
 * @example
 * ```ts
 * router.post("/admin-only", verifyAccessTokenMiddleware, requireRole("ADMIN"), controller)
 * router.post("/paid-feature", verifyAccessTokenMiddleware, requireRole("PRO", "ADMIN"), controller)
 * ```
 */
export const requireRole = (...allowedRoles: user_role[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as UserPayload)?.userId;
      if (!userId) {
        throw new UnauthorizedError("인증 정보가 존재하지 않습니다.");
      }

      const role = await getUserRole(userId);
      if (!role) {
        throw new UnauthorizedError("사용자를 찾을 수 없습니다.");
      }

      if (!allowedRoles.includes(role)) {
        throw new ForbiddenError("접근 권한이 없습니다.");
      }

      req.userRole = role;
      next();
    } catch (error) {
      next(error);
    }
  };
};
