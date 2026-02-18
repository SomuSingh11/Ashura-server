import { wsServer } from "@/lib/websocket-server";
import { wledController } from "@/lib/wled-controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const connectedDevices = wsServer.getConnectedDevices();
    const wledDevices = wledController.getDevices();

    return NextResponse.json({
      success: true,
      data: {
        connectedDevices: connectedDevices,
        wledDevices: wledDevices,
        totalDevices: {
          connected: connectedDevices.length,
          wled: wledDevices.length,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch devices: ${error}`,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, device } = body;

    if (type == "wled") {
      wledController.registerDevice(device);
      return NextResponse.json({
        success: true,
        message: "Wled device registered",
        device,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unknown device type",
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to register device: ${error}` },
      { status: 500 },
    );
  }
}
