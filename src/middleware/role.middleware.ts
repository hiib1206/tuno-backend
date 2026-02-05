import { NextFunction, Request, Response } from "express";
import { user_role } from "../generated/prisma/enums";
import { sendError } from "../utils/commonResponse";
import { getUserRole } from "../utils/role";
import { UserPayload } from "../utils/token";

/**
 * 역할 기반 접근 제어 미들웨어 팩토리.
 * verifyAccessTokenMiddleware 이후에 사용해야 합니다.
 *
 * @example
 * router.post("/admin-only", verifyAccessTokenMiddleware, requireRole("ADMIN"), controller)
 * router.post("/paid-feature", verifyAccessTokenMiddleware, requireRole("PRO", "ADMIN"), controller)
 */
export const requireRole = (...allowedRoles: user_role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as UserPayload)?.userId;
      if (!userId) {
        return sendError(res, 401, "인증 정보가 존재하지 않습니다.");
      }

      const role = await getUserRole(userId);
      if (!role) {
        return sendError(res, 401, "사용자를 찾을 수 없습니다.");
      }

      if (!allowedRoles.includes(role)) {
        return sendError(res, 403, "접근 권한이 없습니다.");
      }

      req.userRole = role;
      next();
    } catch (error) {
      next(error);
    }
  };
};
