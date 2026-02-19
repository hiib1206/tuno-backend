import crypto from "crypto";

const adjectives = [
  "부유한",
  "돈많은",
  "대박난",
  "황금빛",
  "럭키",
  "여유로운",
  "성공한",
  "빛나는",
  "든든한",
  "알뜰한",
  "현명한",
  "똑똑한",
  "신중한",
  "매의눈",
  "철저한",
  "냉철한",
  "공부하는",
  "분석하는",
  "고수의",
  "야수의",
  "떡상하는",
  "올라가는",
  "빨간맛",
  "존버하는",
  "성투하는",
  "졸업하는",
  "익절하는",
  "매수하는",
  "구조된",
  "탈출한",
];

const nouns = [
  "개미",
  "슈퍼개미",
  "황소",
  "곰",
  "고래",
  "독수리",
  "거북이",
  "상어",
  "사자",
  "호랑이",
  "치타",
  "두더지",
  "부엉이",
  "햄스터",
  "흑우",
  "건물주",
  "워렌버핏",
  "대주주",
  "부자",
  "CEO",
  "강남러",
  "월세부자",
  "배당왕",
  "전업러",
  "주린이",
];

/**
 * 랜덤 닉네임을 생성한다.
 *
 * @returns 형용사 + 명사 + 4자리 숫자 패턴의 닉네임 (예: "떡상하는슈퍼개미1024")
 */
export function generateNick(): string {
  const adj = adjectives[crypto.randomInt(adjectives.length)];
  const noun = nouns[crypto.randomInt(nouns.length)];
  const num = crypto.randomInt(1000, 10000);
  return `${adj}${noun}${num}`;
}
