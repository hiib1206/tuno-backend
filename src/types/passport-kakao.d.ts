declare module "passport-kakao" {
  import { Profile, Strategy } from "passport";

  interface StrategyOption {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  }

  interface VerifyFunction {
    (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: (error: any, user?: any) => void
    ): void;
  }

  export class Strategy extends Strategy {
    constructor(options: StrategyOption, verify: VerifyFunction);
    name: string;
  }
}
