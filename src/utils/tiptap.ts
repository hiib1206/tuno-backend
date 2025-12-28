/**
 * Tiptap JSON 객체에서 이미지 URL을 추출하여 배열로 반환
 * @param tiptapJson - Tiptap 에디터의 JSON 객체
 * @returns 이미지 URL 배열
 */
export const extractImageUrls = (tiptapJson: any): string[] => {
  if (!tiptapJson || typeof tiptapJson !== "object") {
    return [];
  }

  const imageUrls: string[] = [];

  // 이미지 노드인 경우 URL 수집
  if (tiptapJson.type === "image" && tiptapJson.attrs?.src) {
    imageUrls.push(tiptapJson.attrs.src);
  }

  // content 배열이 있으면 재귀적으로 탐색
  if (Array.isArray(tiptapJson.content)) {
    tiptapJson.content.forEach((child: any) => {
      imageUrls.push(...extractImageUrls(child));
    });
  }

  return imageUrls;
};

/**
 * Tiptap JSON에서 이미지 URL을 업데이트
 * @param tiptapJson Tiptap JSON 객체
 * @param urlMap 이전 URL을 새 URL로 매핑하는 객체
 */
export const updateImageUrlsInContent = (
  tiptapJson: any,
  urlMap: Record<string, string>
): any => {
  if (!tiptapJson || typeof tiptapJson !== "object") {
    return tiptapJson;
  }

  // 이미지 노드인 경우 URL 업데이트
  if (tiptapJson.type === "image" && tiptapJson.attrs?.src) {
    const oldUrl = tiptapJson.attrs.src;
    if (urlMap[oldUrl]) {
      return {
        ...tiptapJson,
        attrs: {
          ...tiptapJson.attrs,
          src: urlMap[oldUrl],
        },
      };
    }
  }

  // content 배열이 있으면 재귀적으로 업데이트
  if (Array.isArray(tiptapJson.content)) {
    return {
      ...tiptapJson,
      content: tiptapJson.content.map((child: any) =>
        updateImageUrlsInContent(child, urlMap)
      ),
    };
  }

  return tiptapJson;
};
