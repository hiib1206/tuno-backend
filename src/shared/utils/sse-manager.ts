import { Response } from "express";
import redis, { redisSub } from "../../config/redis";

const SSE_CHANNEL = "sse:notification";

// 한 유저가 여러 탭/기기에서 접속할 수 있으므로 배열로 관리한다.
const connections = new Map<string, Response[]>();

/** SSE 연결을 등록한다. */
export const addConnection = (userId: string, res: Response) => {
  const userConnections = connections.get(userId) || [];
  userConnections.push(res);
  connections.set(userId, userConnections);
};

/** SSE 연결을 제거한다. */
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
 * 특정 유저에게 SSE 이벤트를 전송한다.
 *
 * @remarks
 * Redis Pub/Sub을 통해 모든 서버 인스턴스에 브로드캐스트한다.
 *
 * @param userId - 수신자 ID
 * @param event - 이벤트 이름 (예: "notification.created")
 * @param data - 전송할 데이터
 */
export const sendToUser = (userId: string, event: string, data: unknown) => {
  redis.publish(SSE_CHANNEL, JSON.stringify({ userId, event, data }));
};

/**
 * 로컬 연결에 SSE 메시지를 전송한다.
 *
 * @remarks
 * Redis subscriber에서 호출한다.
 */
const deliverToLocal = (userId: string, event: string, data: unknown) => {
  const userConnections = connections.get(userId);
  if (!userConnections || userConnections.length === 0) return;

  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  userConnections.forEach((res) => {
    try {
      res.write(message);
    } catch {
      // 연결이 끊어진 경우 removeConnection에서 정리되므로 무시한다.
    }
  });
};

/**
 * Redis Pub/Sub 구독을 초기화한다.
 *
 * @remarks
 * 서버 시작 시 호출한다.
 */
export const initSSESubscriber = async () => {
  await redisSub.subscribe(SSE_CHANNEL);

  redisSub.on("message", (channel, message) => {
    if (channel !== SSE_CHANNEL) return;

    try {
      const { userId, event, data } = JSON.parse(message);
      deliverToLocal(userId, event, data);
    } catch {
      // JSON 파싱 실패 시 무시한다.
    }
  });
};

/** 현재 연결된 유저 수를 반환한다. (디버깅용) */
export const getConnectionCount = () => {
  let total = 0;
  connections.forEach((conns) => {
    total += conns.length;
  });
  return total;
};
