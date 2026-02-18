import { wledController } from "@/lib/wled-controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { deviceId: string } },
) {
  try {
    const deviceId = params.deviceId;
    const state = await wledController.getDevice(deviceId);

    if (!state) {
      return NextResponse.json(
        {
          success: false,
          error: "Device not found or unreachable",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      deviceId,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get device state",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { deviceId: string } },
) {
  try {
    const deviceId = params.deviceId;
    const body = await req.json();
    const { action, ...data } = body;

    let success = false;

    switch (action) {
      case "turnOn":
        success = await wledController.turnOn(deviceId, data.brightness);
        break;

      case "turnOff":
        success = await wledController.turnOff(deviceId);
        break;

      case "setBrightness":
        success = await wledController.setBrightness(deviceId, data.brightness);
        break;

      case "setColor":
        success = await wledController.setColor(
          deviceId,
          data.r,
          data.g,
          data.b,
        );
        break;

      case "setPreset":
        success = await wledController.setPreset(deviceId, data.preset);
        break;

      case "setEffect":
        success = await wledController.setEffect(deviceId, data.effect);
        break;

      case "setState":
        success = await wledController.setState(deviceId, data.state);
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Action failed",
          },
          { status: 400 },
        );
    }

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to perform action on device",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      deviceId,
      action,
      message: "Action performed successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to perform action on device",
      },
      { status: 500 },
    );
  }
}
