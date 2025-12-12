import passport, { Profile } from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as KakaoStrategy } from "passport-kakao";
import { Strategy as NaverStrategy } from "passport-naver-v2";
import { env } from "./env";

// Google OAuth 전략 설정
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:4000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      // profile 정보를 done 콜백으로 전달
      // 실제 사용자 생성/조회는 컨트롤러에서 처리
      return done(null, profile);
    }
  )
);

// Naver OAuth 전략 설정
passport.use(
  new NaverStrategy(
    {
      clientID: env.NAVER_CLIENT_ID,
      clientSecret: env.NAVER_CLIENT_SECRET,
      callbackURL: "http://localhost:4000/api/auth/naver/callback",
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: (err: any, user: any) => void
    ) => {
      // profile 정보를 done 콜백으로 전달
      // 실제 사용자 생성/조회는 컨트롤러에서 처리
      return done(null, profile);
    }
  )
);

// Kakao OAuth 전략 설정
passport.use(
  new KakaoStrategy(
    {
      clientID: env.KAKAO_CLIENT_ID,
      clientSecret: env.KAKAO_CLIENT_SECRET,
      callbackURL: "http://localhost:4000/api/auth/kakao/callback",
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: (err: any, user: any) => void
    ) => {
      // profile 정보를 done 콜백으로 전달
      // 실제 사용자 생성/조회는 컨트롤러에서 처리
      return done(null, profile);
    }
  ) as any
);

// 세션을 사용하지 않으므로 serialize/deserialize는 간단하게 처리
passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
