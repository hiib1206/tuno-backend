import app from "./app.js";
import http from "http";
import { env } from "./config/env.js";

const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
