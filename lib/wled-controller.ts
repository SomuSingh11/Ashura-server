/* eslint-disable @typescript-eslint/no-explicit-any */
export interface WLEDDevice {
  id: string;
  name: string;
  ip: string;
  lastSeen?: number;
}

export interface WLEDState {
  on: boolean;
  bri: number;
  seg?: Array<{
    id: number;
    col?: number[][];
    fx?: number;
  }>;
  preset?: number;
}

class WLEDController {
  private devices: Map<string, WLEDDevice> = new Map();
  private stateCache: Map<string, WLEDState> = new Map();

  registerDevice(device: WLEDDevice) {
    const normalizedIp = device.ip.replace(/^http?:\/\//, "");
    this.devices.set(device.id, {
      ...device,
      ip: normalizedIp,
      lastSeen: Date.now(),
    });

    console.log(`✅ WLED Device registered: ${device.name} (${normalizedIp})`);
  }

  getDevices(): WLEDDevice[] {
    return Array.from(this.devices.values());
  }

  getDevice(deviceId: string): WLEDDevice | undefined {
    return this.devices.get(deviceId);
  }

  // send state to wled devices
  async setState(
    deviceId: string,
    state: Partial<WLEDState>,
  ): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      console.log(`Device ${deviceId} not found`);
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const response = await fetch(`http://${device.ip}/json/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      device.lastSeen = Date.now();
      console.log(`State sent to ${device.name}`);
      return true;
    } catch (error) {
      console.error(`Failed to reach ${device.name}: ${error}`);
      return false;
    }
  }

  // get current state from wled devices
  async getState(deviceId: string): Promise<WLEDState | null> {
    const device = this.devices.get(deviceId);
    if (!device) {
      console.error(`Device ${deviceId} not found`);
      return null;
    }

    try {
      const response = await fetch(`http://${device.ip}/json/state`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const state: WLEDState = await response.json();

      device.lastSeen = Date.now();
      this.stateCache.set(deviceId, state);

      return state;
    } catch (error) {
      console.error(`Failed to get updated state for ${device.name}: ${error}`);
      return this.stateCache.get(deviceId) || null;
    }
  }

  //get device info
  async getInfo(deviceId: string): Promise<any> {
    const device = this.devices.get(deviceId);
    if (!device) {
      console.error(`Device ${deviceId} not found`);
      return null;
    }

    try {
      const response = await fetch(`http://${device.ip}/json/info`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      device.lastSeen = Date.now();
      return await response.json();
    } catch (error) {
      console.error(`Failed to get info from ${device.name}: ${error}`);
      return null;
    }
  }

  // helper methods to control wled

  async turnOn(deviceId: string, brightness?: number): Promise<boolean> {
    const state: Partial<WLEDState> = { on: true };

    if (brightness !== undefined) {
      state.bri = Math.min(255, Math.max(1, brightness));
    }

    return this.setState(deviceId, state);
  }

  async turnOff(deviceId: string): Promise<boolean> {
    return this.setState(deviceId, { on: false });
  }

  async setBrightness(deviceId: string, brightness: number): Promise<boolean> {
    return this.setState(deviceId, {
      bri: Math.min(255, Math.max(1, brightness)),
    });
  }

  async setPreset(deviceId: string, presetId: number): Promise<boolean> {
    return this.setState(deviceId, {
      preset: presetId,
    });
  }

  async setColor(
    deviceId: string,
    r: number,
    g: number,
    b: number,
  ): Promise<boolean> {
    return this.setState(deviceId, {
      seg: [{ id: 0, col: [[r, g, b]] }],
    });
  }

  async setEffect(deviceId: string, effectId: number): Promise<boolean> {
    return this.setState(deviceId, {
      seg: [
        {
          id: 0,
          fx: effectId,
        },
      ],
    });
  }
}

export const wledController = new WLEDController();
