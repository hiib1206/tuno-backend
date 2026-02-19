import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/commonResponse";
import { UserPayload } from "../../shared/utils/token";
import {
  CreateStockCommentBodySchema,
  DeleteMyStockCommentsQuerySchema,
  GetStockCommentListParamsSchema,
  GetStockCommentListQuerySchema,
  StockCommentIdParamsSchema,
  UpdateStockCommentBodySchema,
} from "./stock-comment.schema";
import {
  createStockCommentService,
  deleteMyStockCommentsService,
  deleteStockCommentService,
  getStockCommentListService,
  updateStockCommentService,
} from "./stock-comment.service";

/** 종목 댓글 목록을 조회한다. */
export const getStockCommentList = async (req: Request, res: Response) => {
  const { ticker } = req.validated?.params as GetStockCommentListParamsSchema;
  const queryParams = req.validated?.query as GetStockCommentListQuerySchema;

  const data = await getStockCommentListService(ticker, queryParams);

  return sendSuccess(res, 200, "종목 댓글 목록을 조회했습니다.", data);
};

/** 종목 댓글을 작성한다. */
export const createStockComment = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const body = req.validated?.body as CreateStockCommentBodySchema;

  const data = await createStockCommentService(userId, body);

  return sendSuccess(res, 201, "종목 댓글이 생성되었습니다.", data);
};

/** 종목 댓글을 수정한다. */
export const updateStockComment = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { id } = req.validated?.params as StockCommentIdParamsSchema;
  const body = req.validated?.body as UpdateStockCommentBodySchema;

  const data = await updateStockCommentService(userId, id, body);

  return sendSuccess(res, 200, "종목 댓글이 수정되었습니다.", data);
};

/** 종목 댓글을 삭제한다. */
export const deleteStockComment = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { id } = req.validated?.params as StockCommentIdParamsSchema;

  await deleteStockCommentService(userId, id);

  return sendSuccess(res, 200, "종목 댓글이 삭제되었습니다.");
};

/** 본인 종목 댓글을 일괄 삭제한다. */
export const deleteMyStockComments = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { ticker } = req.validated?.query as DeleteMyStockCommentsQuerySchema;

  const data = await deleteMyStockCommentsService(userId, ticker);

  return sendSuccess(res, 200, "종목 댓글이 삭제되었습니다.", data);
};
