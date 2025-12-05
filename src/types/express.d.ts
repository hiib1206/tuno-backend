import { Profile } from "passport";
import { UserPayload } from "../utils/token";

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload | Profile;
      refreshToken?: string;
      deviceId?: string;
    }
  }
}

export {};
