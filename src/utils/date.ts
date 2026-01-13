/**
 * 날짜 변환 유틸 함수
 */

/**
 * YYYYMMDD 형식의 문자열을 Unix timestamp (초 단위)로 변환
 * @param dateStr - YYYYMMDD 형식의 날짜 문자열 (예: "20240101")
 * @returns Unix timestamp (초 단위)
 */
export const yyyymmddToUnixTimestamp = (dateStr: string): number => {
  if (!dateStr || dateStr.length !== 8) {
    throw new Error(
      "날짜 형식이 올바르지 않습니다. YYYYMMDD 형식이어야 합니다."
    );
  }

  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // 월은 0부터 시작
  const day = parseInt(dateStr.substring(6, 8), 10);

  const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return Math.floor(date.getTime() / 1000);
};

/**
 * Unix timestamp (초 단위)를 YYYYMMDD 형식의 문자열로 변환
 * @param timestamp - Unix timestamp (초 단위)
 * @returns YYYYMMDD 형식의 날짜 문자열 (예: "20240101")
 */
export const unixTimestampToYyyymmdd = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
};
