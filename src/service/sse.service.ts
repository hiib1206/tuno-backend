import { Response } from "express";

// userId -> SSE Response 객체 배열 (한 유저가 여러 탭/기기에서 접속 가능)
const connections = new Map<string, Response[]>();

/**
 * SSE 연결 등록
 */
export const addConnection = (userId: string, res: Response) => {
  const userConnections = connections.get(userId) || [];
  userConnections.push(res);
  connections.set(userId, userConnections);
};

/**
 * SSE 연결 제거
 */
export const removeConnection = (userId: string, res: Response) => {
  const userConnections = connections.get(userId);
  if (!userConnections) return;

  const filtered = userConnections.filter((conn) => conn !== res);
  if (filtered.length === 0) {
    connections.delete(userId);
  } else {
    connections.set(userId, filtered);
  }
};

/**
 * 특정 유저에게 SSE 이벤트 전송
 * @param userId 수신자 ID
 * @param event 이벤트 이름 (예: "notification.created")
 * @param data 전송할 데이터
 */
export const sendToUser = (userId: string, event: string, data: unknown) => {
  const userConnections = connections.get(userId);
  if (!userConnections || userConnections.length === 0) return;

  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  userConnections.forEach((res) => {
    try {
      res.write(message);
    } catch {
      // 연결이 끊어진 경우 무시 (removeConnection에서 정리됨)
    }
  });
};

/**
 * 현재 연결된 유저 수 (디버깅용)
 */
export const getConnectionCount = () => {
  let total = 0;
  connections.forEach((conns) => {
    total += conns.length;
  });
  return total;
};
