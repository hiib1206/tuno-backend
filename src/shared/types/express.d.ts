import { Profile } from "passport";
import { user_role } from "../../generated/prisma/enums";
import { UserPayload } from "../utils/token";

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload | Profile;
      userRole?: user_role;
      refreshToken?: string;
      deviceId?: string;
      validated?: {
        body?: any;
        query?: any;
        params?: any;
      };
    }
  }
}

export {};
