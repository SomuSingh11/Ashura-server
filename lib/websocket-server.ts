/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { v4 as uuidv4 } from "uuid";

export type MessageType =
  | "register"
  | "heartbeat"
  | "command"
  | "status"
  | "notification"
  | "agent_response";

// structure of every message sent over WebSocket.
export interface WebSocketMessage {
  type: MessageType;
  deviceId?: string;
  deviceType?: "esp32" | "web_client";
  data?: any;
  timestamp?: number;
}

// represents a device currently connected to the server.
export interface ConnectedDevice {
  id: string;
  type: "esp32" | "web_client";
  ws: WebSocket;
  lastHeartbeat: number;
  metadata?: any;
}

// websocket manager
class CoreWebSocketServer {
  private wss: WebSocketServer | null = null; // websocket server
  private connectionMap: Map<WebSocket, string> = new Map(); // maps websocket to deviceId
  private devices: Map<string, ConnectedDevice> = new Map(); // maps deviceId to connected devices
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: "/ws", //this attaches WebSocket to your HTTP server at: ws://yourserver.com/ws
    });

    console.log("Websocket Server initialized on /ws");

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      // ws represents client(esp32 or web client)
      console.log("New Websocket connection from:", req.socket.remoteAddress);

      const tempId = uuidv4();

      // when connected client sends message, runs this function
      ws.on("message", (message: Buffer) => {
        try {
          const data: WebSocketMessage = JSON.parse(message.toString());
          this.handleMessage(ws, data, tempId);
        } catch (error) {
          console.error("Failed to parse message", error);
          this.sendError(ws, "Invalid JSON Format");
        }
      });

      ws.on("close", () => {
        const deviceId = this.connectionMap.get(ws);
        if (deviceId) {
          console.log("Connection closed for device:", deviceId);
          this.devices.delete(deviceId);
          this.connectionMap.delete(ws);

          this.broadcast({
            type: "notification",
            data: {
              event: "device_disconnected",
              deviceId: deviceId,
            },
            timestamp: Date.now(),
          });
        }
      });

      ws.on("error", (error) => {
        console.error("Websocket error for device:", tempId, error);
      });

      // send welcome message to new connection(client-esp32 or web client)
      this.send(ws, {
        type: "status",
        data: {
          status: "connected",
          message: "Welcome! Please register your device.",
        },
        timestamp: Date.now(),
      });
    });

    this.startHeartbeatChecker();
  }

  private handleMessage(
    ws: WebSocket,
    message: WebSocketMessage,
    connectionId: string,
  ) {
    console.log(
      "Received:",
      message.type,
      "from:",
      message.deviceId || connectionId,
    );

    switch (message.type) {
      case "register":
        this.registerDevice(ws, message, connectionId);
        break;

      case "heartbeat":
        const deviceId = message.deviceId || this.connectionMap.get(ws);
        if (deviceId) {
          this.handleHeartbeat(deviceId);
        }
        break;

      case "command":
        this.handleCommand(message);
        break;

      case "status":
        this.broadcastStatus(message);
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  }

  private registerDevice(
    ws: WebSocket,
    message: WebSocketMessage,
    tempId: string,
  ) {
    const deviceId = message.deviceId || tempId;
    const deviceType = message.deviceType || "web_client";

    const device: ConnectedDevice = {
      id: deviceId,
      type: deviceType,
      ws: ws,
      lastHeartbeat: Date.now(),
      metadata: message.data,
    };

    if (this.devices.has(deviceId)) {
      console.warn(
        `Device ID ${deviceId} already registered. Overwriting existing connection.`,
      );
      this.devices.get(deviceId)?.ws.close(1000, "Duplicate device ID");
    }

    this.devices.set(deviceId, device);
    //console.log(this.devices.values());
    this.connectionMap.set(ws, deviceId);
    //console.log(this.connectionMap.values());

    console.log(`Device registered: ${deviceId} (${deviceType})`);
    console.log(`Total devices: ${this.devices.size}`);

    // confirm registration
    this.send(ws, {
      type: "status",
      data: {
        status: "registered",
        deviceId: deviceId,
        message: "Device registered successfully",
      },
      timestamp: Date.now(),
    });

    // notify other clients about new device
    this.broadcast(
      {
        type: "notification",
        data: {
          event: "device_connected",
          deviceId: deviceId,
          deviceType: deviceType,
        },
        timestamp: Date.now(),
      },
      deviceId,
    );
  }

  private handleHeartbeat(deviceId: string) {
    const device = this.devices.get(deviceId);

    if (device) {
      device.lastHeartbeat = Date.now();
    }
  }

  private handleCommand(message: WebSocketMessage) {
    console.log("Command received:", message.data);

    if (message.data?.targetDevice) {
      this.sendToDevice(message.data.targetDevice, {
        type: "command",
        data: message.data,
        timestamp: Date.now(),
      });
    }
  }

  private broadcastStatus(message: WebSocketMessage) {
    this.broadcast({
      type: "status",
      data: message.data,
      deviceId: message.deviceId,
      timestamp: Date.now(),
    });
  }

  public sendToDevice(deviceId: string, message: WebSocketMessage) {
    const device = this.devices.get(deviceId);

    if (device && device.ws.readyState === WebSocket.OPEN) {
      this.send(device.ws, message);
      return true;
    }

    console.log(`Device ${deviceId} not found or not connected`);
    return false;
  }

  public broadcast(message: WebSocketMessage, excludedDeviceId?: string) {
    let count = 0;

    this.devices.forEach((device, deviceId) => {
      if (
        deviceId !== excludedDeviceId &&
        device.ws.readyState === WebSocket.OPEN
      ) {
        this.send(device.ws, message);
        count++;
      }
    });

    console.log(`Broadcast to ${count} devices`);
  }

  public getConnectedDevices() {
    return Array.from(this.devices.values()).map((device) => {
      return {
        id: device.id,
        type: device.type,
        lastHeartbeat: device.lastHeartbeat,
        metadata: device.metadata,
      };
    });
  }

  public getDeviceById(deviceId: string) {
    return this.devices.get(deviceId);
  }

  private send(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message)); //ws.send: send message to client(esp32 or web client)
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, {
      type: "status",
      data: {
        status: "error",
        message: error,
      },
      timestamp: Date.now(),
    });
  }

  private startHeartbeatChecker() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 10000;

      this.devices.forEach((device, deviceId) => {
        if (now - device.lastHeartbeat > timeout) {
          console.log(`Device ${deviceId} timed out, removing...`);

          this.connectionMap.delete(device.ws);
          device.ws.close();
          this.devices.delete(deviceId);
        }
      });
    }, 1000);
  }

  public shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.close();
    }

    this.devices.clear();
    this.connectionMap.clear();

    console.log("Websockets server shut down");
  }
}

export const wsServer = new CoreWebSocketServer();
