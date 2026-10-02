import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const port = Number(process.env.ANALYTICS_LOCAL_PORT || 8799);
const file = path.resolve(process.cwd(), ".analytics/session.jsonl");

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(
  file,
  `${JSON.stringify({
    kind: "session",
    at: new Date().toISOString(),
    note: "Local Metro/e2e analytics. Not sent to PostHog.",
  })}\n`
);

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }

  if (request.method !== "POST" || request.url !== "/events") {
    response.writeHead(404);
    response.end();
    return;
  }

  const chunks = [];
  request.on("data", (chunk) => {
    chunks.push(chunk);
    if (chunks.reduce((sum, part) => sum + part.length, 0) > 1_000_000) {
      request.destroy();
    }
  });
  request.on("end", () => {
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      fs.appendFileSync(file, `${JSON.stringify(parsed)}\n`);
      response.writeHead(204);
      response.end();
    } catch {
      response.writeHead(400);
      response.end();
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local analytics log: http://127.0.0.1:${port}/events`);
  console.log(file);
});
