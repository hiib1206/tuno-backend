# tuno-backend

> AI 기반 주식 분석 플랫폼 tuno의 백엔드 API 서버

## 관련 레포지토리

| 서비스 | 설명 | 링크 |
|--------|------|------|
| tuno-frontend | Next.js 웹 클라이언트 | [GitHub](https://github.com/hiib1206/tuno-frontend) |
| **tuno-backend** | Express API 서버 (현재) | - |
| tuno-ai | FastAPI 기반 AI/ML 파이프라인 | [GitHub](https://github.com/hiib1206/tuno-ai) |
| tuno-ws | 실시간 WebSocket 서버 | [GitHub](https://github.com/hiib1206/tuno-ws) |
| tuno-infra | Docker/Nginx 인프라 구성 | [GitHub](https://github.com/hiib1206/tuno-infra) |

## 왜 만들었는가

프론트엔드와 AI 서버 사이에서 인증, 데이터 캐싱, 비즈니스 로직을 처리하는 중간 계층이 필요했습니다.

- **인증/인가 중앙화**: JWT + Refresh Token 기반 인증, OAuth(Google/Naver/Kakao) 통합
- **데이터 레이어**: 주식 마스터, 캔들 데이터, 재무제표 등 금융 데이터 관리
- **AI 서버 프록시**: 추론 요청 관리, 쿼터 제한, 결과 히스토리 저장
- **실시간 알림**: Redis Pub/Sub + SSE 기반 알림 시스템

## 주요 기능

### 인증 (Auth)
- 이메일 인증 기반 회원가입
- JWT Access Token + Refresh Token
- OAuth 2.0 (Google, Naver, Kakao)
- 비밀번호 재설정

### 주식 (Stock)
- 종목 마스터 정보 조회
- 일봉 캔들 데이터
- 지수 분봉/캔들
- 현재가 시세 (tuno-ai 프록시)
- 호가 조회
- 관심종목 CRUD

### AI 추론 (Inference)
- Snapback 추론 요청/결과 저장
- Quant Signal 비동기 추론
- 추론 히스토리 관리
- 일일 쿼터 관리

### 커뮤니티 (Post/Comment)
- 게시판 CRUD (질문/종목/자유)
- 댓글/대댓글
- 좋아요

### 뉴스 (News)
- Google News RSS 크롤링
- 토픽별/검색별 뉴스
- 썸네일 추출 및 캐싱

### 알림 (Notification)
- Redis Pub/Sub 기반 실시간 알림
- SSE 스트리밍
- 읽음 처리

## 기술 스택

### Core
| 기술 | 버전 |
|------|------|
| **Node.js** | 22 |
| **Express** | 5 |
| **TypeScript** | 5.9 |

### 데이터베이스
| 기술 | 용도 |
|------|------|
| **MariaDB** | 메인 DB |
| **Prisma** | ORM |
| **Redis** | 캐싱, 세션, Pub/Sub |

### 인증
| 기술 | 용도 |
|------|------|
| **Passport** | OAuth 전략 (Google, Naver, Kakao) |
| **JWT** | Access/Refresh Token |
| **bcrypt** | 비밀번호 해싱 |

### 유틸리티
| 기술 | 용도 |
|------|------|
| **Zod** | 요청 유효성 검증, OpenAPI 문서 자동 생성 |
| **Winston** | 로깅 |
| **Resend** | 이메일 발송 |
| **node-cron** | 스케줄러 |
| **cheerio** | HTML 파싱 (뉴스 썸네일) |
| **rss-parser** | RSS 피드 파싱 |

### 외부 연동
| 기술 | 용도 |
|------|------|
| **Firebase Admin** | 이미지 스토리지 |
| **Axios** | tuno-ai 서버 통신 |

## 프로젝트 구조

```
tuno-backend/
├── src/
│   ├── config/              # 설정 (env, prisma, redis, passport, logger)
│   ├── middleware/          # 미들웨어 (auth, error, validation, quota)
│   ├── modules/             # 도메인별 모듈
│   │   ├── auth/            # 인증 (controller, service, routes, schema)
│   │   ├── user/            # 사용자
│   │   ├── stock/           # 주식
│   │   ├── inference/       # AI 추론
│   │   ├── post/            # 게시판
│   │   ├── post-comment/    # 댓글
│   │   ├── stock-comment/   # 종목 댓글
│   │   ├── news/            # 뉴스
│   │   ├── notification/    # 알림
│   │   └── theme/           # 테마주
│   ├── shared/              # 공통 모듈
│   │   ├── errors/          # 커스텀 에러 클래스
│   │   ├── utils/           # 유틸리티 (token, email, sse-manager 등)
│   │   └── types/           # 공통 타입
│   ├── openapi/             # OpenAPI 문서 생성 (Swagger UI)
│   ├── scheduler/           # 크론 작업 (조회수 동기화)
│   ├── generated/           # Prisma 생성 파일
│   ├── app.ts               # Express 앱 설정
│   └── index.ts             # 엔트리포인트
├── test/                    # 테스트 (node:test + supertest)
│   ├── unit/                # Unit 테스트 (스키마 검증)
│   └── component/           # Component 테스트 (API 유효성 검사)
├── prisma/
│   └── schema.prisma        # DB 스키마
└── firebase/                # Firebase 서비스 계정
```

## 아키텍처 특징

### 모듈 구조
각 도메인은 독립적인 모듈로 분리:
- `controller`: HTTP 요청/응답 처리
- `service`: 비즈니스 로직
- `routes`: 라우터 정의
- `schema`: Zod 스키마 (요청 검증)

### 에러 처리
커스텀 `AppError` 클래스 기반:
- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ExternalApiError` (외부 API 에러)

### 인증 플로우
```
1. 로그인 → Access Token + Refresh Token 발급
2. API 요청 → Access Token 검증
3. 만료 시 → Refresh Token으로 갱신
4. Refresh Token은 Redis에 저장 (기기별 관리)
```

### 실시간 알림
```
1. 알림 발생 → DB 저장 + Redis Publish
2. SSE 구독자 → Redis Subscribe
3. 클라이언트 → SSE EventSource로 수신
```

### Graceful Shutdown
SIGTERM/SIGINT 시:
1. HTTP 서버 종료
2. Redis 연결 종료
3. Prisma 연결 종료
4. 10초 타임아웃 후 강제 종료

### API 문서화 (Swagger)
Zod 스키마 기반 OpenAPI 문서 자동 생성:
- `zod-to-openapi`로 Zod 스키마 → OpenAPI 스펙 변환
- Swagger UI (`/api-docs`)로 API 문서 제공
- 개발 환경에서만 활성화 (운영 환경 비활성화)
- **샘플 구현**: auth 도메인만 문서화 (다른 도메인 확장 가능)

### 테스트 (Testing)
Node.js 내장 테스트 러너 + supertest 기반 테스트:
- `node:test` + `node:assert` — 외부 의존성 없이 테스트
- `supertest` — HTTP API 레벨 테스트
- **Unit 테스트**: Zod 스키마 검증 로직 테스트
- **Component 테스트**: Express 미들웨어 + API 유효성 검사 테스트
- **샘플 구현**: auth 도메인 (다른 도메인 확장 가능)

```bash
npm test              # 전체 테스트 실행
npm run test:unit     # Unit 테스트만 실행
npm run test:component # Component 테스트만 실행
```

## 설치 및 실행

### 요구사항
- Node.js 22+
- MariaDB 8+
- Redis 7+

### 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 수정

# Prisma 클라이언트 생성
npx prisma generate

# DB 마이그레이션
npx prisma migrate deploy
```

### 개발 서버 실행

```bash
npm run dev
```

- API 문서: `http://localhost:{PORT}/api-docs` (개발 환경에서만 활성화, auth 도메인 샘플 구현)

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 배운 점

- **Prisma**: MariaDB과의 타입 안전한 연동, 마이그레이션 관리
- **Redis Pub/Sub**: SSE 기반 실시간 알림 시스템 구현
- **OAuth 통합**: 여러 소셜 로그인을 Passport로 일관되게 처리

## 어려웠던 점

- **Refresh Token 관리**: 기기별 토큰 관리, 토큰 탈취 대응
- **SSE 연결 관리**: 연결 끊김 감지, 재연결 처리
- **AI 서버 타임아웃**: 긴 추론 시간 처리 (비동기 패턴 도입)
