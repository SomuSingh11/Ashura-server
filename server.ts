// server.ts
import { createServer } from "http";
import next from "next";
import { parse } from "url";
import { wsServer } from "@/lib/websocket-server"; // your WS server instance
import { wledController } from "./lib/wled-controller";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      if (!req.url) {
        res.statusCode = 400;
        res.end("Bad Request");
        return;
      }

      const parsedUrl = parse(req.url, true);

      // -------------------------
      // Custom API route: /api/devices
      // -------------------------
      if (parsedUrl.pathname === "/api/devices") {
        const connectedDevices = wsServer.getConnectedDevices(); // from your WS server
        const wledDevices = wledController.getDevices?.() || []; // if you have a method for WLED

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            data: {
              connectedDevices,
              wledDevices,
              totalDevices: {
                connected: connectedDevices.length,
                wled: wledDevices.length,
              },
            },
          }),
        );
        return;
      }

      // -------------------------
      // Next.js pages / routes
      // -------------------------
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Initialize WebSocket server on the same HTTP server
  wsServer.initialize(server);

  server.listen(port, () => {
    console.log(`> Server listening at http://${hostname}:${port}`);
  });
});
