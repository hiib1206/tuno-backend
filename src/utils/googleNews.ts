import axios from "axios";
import * as cheerio from "cheerio";
// @ts-ignore - ESM에서 CommonJS named export import
import GoogleNewsDecoder from "google-news-decoder";
import Parser from "rss-parser";

const parser = new Parser();

// HTTP 요청 시 사용할 User-Agent (실제 Chrome 브라우저로 인식되도록 설정)
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Google News RSS URL에 한국어 파라미터를 설정합니다.
 * @param url - 파라미터를 설정할 URL 객체
 * @returns 한국어 파라미터가 설정된 URL 객체 (?hl=ko&gl=KR&ceid=KR%3Ako)
 */
function setKoreanParams(url: URL): URL {
  url.searchParams.set("hl", "ko");
  url.searchParams.set("gl", "KR");
  url.searchParams.set("ceid", "KR%3Ako");
  return url;
}

/**
 * Google News 주요 뉴스(Top Stories) RSS URL을 생성합니다.
 * @returns 주요 뉴스 RSS URL
 * @example
 * const url = createHomeRssUrl();
 * const news = await fetchGoogleNews(url);
 */
export function createHomeRssUrl(): URL {
  return setKoreanParams(new URL("https://news.google.com/rss"));
}

/**
 * Google News 토픽별 뉴스 RSS URL을 생성합니다.
 * @param topicId - Google News 토픽 ID
 * @returns 토픽별 뉴스 RSS URL
 * @example
 * // 비즈니스(경제) 토픽
 * const url = createTopicRssUrl("CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVd3U0FtdHZHZ0pMVWlnQVAB");
 * const news = await fetchGoogleNews(url);
 */
export function createTopicRssUrl(topicId: string): URL {
  return setKoreanParams(
    new URL(`https://news.google.com/rss/topics/${topicId}`)
  );
}

/**
 * Google News 검색 결과 RSS URL을 생성합니다.
 * @param query - 검색어 (예: "삼성전자", "삼성전자 site:mk.co.kr")
 * @returns 검색 결과 RSS URL (https://news.google.com/rss/search?hl=ko&gl=KR&ceid=KR%3Ako&q=삼성전자)
 * @example
 * // 일반 검색
 * const url = createSearchRssUrl("삼성전자");
 * // 특정 언론사 내 검색
 * const url2 = createSearchRssUrl("삼성전자 site:mk.co.kr");
 */
export function createSearchRssUrl(query: string): URL {
  const url = setKoreanParams(new URL("https://news.google.com/rss/search"));
  url.searchParams.set("q", query);
  return url;
}

/**
 * Google News RSS 피드를 파싱하여 커서 페이지네이션이 적용된 뉴스 데이터를 반환합니다.
 * @param url - Google News RSS URL (createHomeRssUrl, createTopicRssUrl, createSearchRssUrl로 생성)
 * @param cursor - 마지막으로 본 뉴스의 ID (guid). 이 ID 다음부터 데이터를 반환합니다.
 * @param limit - 한 번에 가져올 뉴스 개수 (기본값: 10)
 * @returns 페이지네이션이 적용된 뉴스 아이템 배열과 메타 정보
 * @example
 * const url = createSearchRssUrl("삼성전자");
 * const { items, meta } = await fetchGoogleNews(url);
 * console.log(items[0].title); // 뉴스 제목
 * console.log(meta.nextCursor); // 다음 페이지 커서
 */
export async function fetchGoogleNews(
  url: URL,
  cursor?: string,
  limit: number = 10
) {
  // 1. Google News RSS 데이터 전체 가져오기 (보통 50~100개 사이)
  const feed = await parser.parseURL(url.toString());
  const allItems = feed.items.map((item) => {
    const title = item.title || "";

    // 1. 뒤에서부터 " - " 위치 찾기
    const lastDashIndex = title.lastIndexOf(" - ");

    let cleanTitle = title;
    let source = "알 수 없음";

    // 2. 구분자를 찾았을 때만 분리
    if (lastDashIndex !== -1) {
      cleanTitle = title.substring(0, lastDashIndex).trim(); // 앞부분
      source = title.substring(lastDashIndex + 3).trim(); // " - " 가 3글자이므로 +3
    }

    return {
      id: item.guid, // 이 guid를 커서로 사용
      title: cleanTitle,
      source,
      link: item.link,
      pubDate: item.isoDate,
    };
  });

  // 2. 커서 위치 찾기
  let startIndex = 0;
  if (cursor) {
    const foundIndex = allItems.findIndex((item) => item.id === cursor);
    // 커서를 찾았다면 그 다음 아이템부터 시작, 못 찾았다면(삭제 등) 0번부터 시작
    if (foundIndex !== -1) {
      startIndex = foundIndex + 1;
    }
  }

  // 3. 데이터 자르기 (다음 페이지가 있는지 확인하기 위해 limit + 1개를 가져옴)
  const paginatedItems = allItems.slice(startIndex, startIndex + limit + 1);

  const hasNextPage = paginatedItems.length > limit;
  const items = hasNextPage ? paginatedItems.slice(0, limit) : paginatedItems;

  // 4. 다음 페이지를 위한 커서 설정 (마지막 아이템의 ID)
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;

  return {
    items,
    meta: {
      nextCursor,
      hasNextPage,
    },
  };
}

/**
 * Google News URL을 디코딩하고 실제 기사에서 썸네일(og:image)을 추출합니다.
 * @param googleUrl - Google News 링크 (CBMi... 형태의 식별자 포함)
 * @returns 원본 URL과 썸네일 이미지 URL
 * @example
 * const result = await getNewsWithThumbnail("https://news.google.com/rss/articles/CBMi...");
 * console.log(result.originalUrl); // 실제 기사 URL
 * console.log(result.thumbnail); // 썸네일 이미지 URL
 */
export const getNewsWithThumbnail = async (googleUrl: string) => {
  try {
    // 1. 구글 뉴스 링크 디코딩 (CBMi... -> 진짜 주소)
    // 이 라이브러리가 구글의 복잡한 식별자를 해석해줍니다.
    const decoder = new GoogleNewsDecoder();
    const result = await decoder.decodeGoogleNewsUrl(googleUrl);
    const originalUrl = result.decodedUrl;

    if (!originalUrl) {
      return null;
    }

    // 2. 실제 기사 사이트의 HTML 가져오기
    // 언론사 사이트(다음, 연합뉴스 등)는 로봇을 차단할 수 있으므로 User-Agent 설정이 중요합니다.
    const { data: html } = await axios.get(originalUrl, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      timeout: 5000, // 5초 안에 응답 없으면 타임아웃
    });

    // 3. Cheerio로 썸네일(og:image) 추출
    const $ = cheerio.load(html);

    // og:image 전부 수집
    const ogImages = $('meta[property="og:image"]')
      .map((_, el) => $(el).attr("content"))
      .get()
      .filter(Boolean);

    // twitter:image 전부 수집
    const twitterImages = $('meta[name="twitter:image"]')
      .map((_, el) => $(el).attr("content"))
      .get()
      .filter(Boolean);

    // 후보군 합치기 (og:image 우선)
    const candidates = [...ogImages, ...twitterImages];

    // 뒤에서부터 유효한 썸네일 찾기
    let thumbnail = "";
    for (let i = candidates.length - 1; i >= 0; i--) {
      const img = candidates[i];

      if (
        img.includes("logo") ||
        img.includes("favicon") ||
        img.includes("symbol")
      ) {
        continue;
      }

      thumbnail = img;
      break;
    }

    // fallback
    if (!thumbnail && candidates.length > 0) {
      thumbnail = candidates[candidates.length - 1];
    }

    // 상대경로 → 절대경로
    if (thumbnail && thumbnail.startsWith("/")) {
      thumbnail = new URL(thumbnail, originalUrl).href;
    }

    return {
      originalUrl,
      thumbnail,
    };
  } catch (error) {
    // axios 에러인 경우 간단한 정보만 출력
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const url = error.config?.url || googleUrl;
      console.error(
        `뉴스 데이터 추출 실패: ${url} (${status || error.message})`
      );
    } else {
      console.error(
        "데이터 추출 중 에러 발생:",
        error instanceof Error ? error.message : String(error)
      );
    }
    return null;
  }
};
