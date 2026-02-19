import { lsRequest } from "../client";
import { API_PATH } from "../constants";

export type T8425InBlock = {
  dummy: string;
};

export type T8425Request = {
  t8425InBlock: T8425InBlock;
};

export type T8425OutBlockItem = {
  tmname: string; // 테마명
  tmcode: string; // 테마코드
};

export type T8425Response = {
  rsp_cd: string;
  rsp_msg: string;
  t8425OutBlock: T8425OutBlockItem[];
};

/** 전체 테마 목록을 조회한다 (t8425). */
export const getThemeList = async (): Promise<T8425OutBlockItem[]> => {
  const response = await lsRequest<T8425Response>({
    trCode: "t8425",
    path: API_PATH.SECTOR,
    body: {
      t8425InBlock: {
        dummy: "",
      },
    },
  });

  return response.t8425OutBlock;
};
