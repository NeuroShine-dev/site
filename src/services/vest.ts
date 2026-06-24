import { Buffer } from 'buffer';
import { BleManager, Device, State } from 'react-native-ble-plx';
import { VestState, VestHapticZone, VestHapticPattern, ObstacleZone } from '../types';
import { BLE } from '../constants';

type VestListener = (state: VestState) => void;
type PacketListener = (zone: ObstacleZone, distanceMeters: number) => void;

class VestService {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private stateListeners: VestListener[] = [];
  private packetListeners: PacketListener[] = [];
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private vestState: VestState = { connected: false, batteryPercent: 0 };

  private getManager(): BleManager {
    if (!this.manager) {
      this.manager = new BleManager();
    }
    return this.manager;
  }

  addStateListener(listener: VestListener): () => void {
    this.stateListeners.push(listener);
    return () => { this.stateListeners = this.stateListeners.filter(l => l !== listener); };
  }

  addPacketListener(listener: PacketListener): () => void {
    this.packetListeners.push(listener);
    return () => { this.packetListeners = this.packetListeners.filter(l => l !== listener); };
  }

  async scan(): Promise<Device[]> {
    const manager = this.getManager();
    const state = await manager.state();
    if (state !== State.PoweredOn) {
      throw new Error('Bluetooth is off. Please enable Bluetooth to connect the vest.');
    }

    const found: Device[] = [];
    return new Promise((resolve, reject) => {
      this.scanTimeout = setTimeout(() => {
        manager.stopDeviceScan();
        resolve(found);
      }, BLE.SCAN_TIMEOUT_MS);

      manager.startDeviceScan(
        [BLE.VEST_SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            manager.stopDeviceScan();
            clearTimeout(this.scanTimeout!);
            reject(error);
            return;
          }
          if (device) found.push(device);
        },
      );
    });
  }

  async connect(deviceId: string): Promise<void> {
    const manager = this.getManager();
    const device = await manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();
    this.device = device;

    device.onDisconnected(() => this.handleDisconnect());

    const battery = await this.readBattery(device);
    this.updateState({ connected: true, batteryPercent: battery, deviceId, deviceName: device.name ?? 'BlindAid Vest' });

    this.subscribeToSensorData(device);
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      await this.device.cancelConnection();
      this.device = null;
    }
    this.updateState({ connected: false, batteryPercent: 0 });
  }

  private handleDisconnect(): void {
    this.device = null;
    this.updateState({ connected: false });

    // Auto-reconnect after delay
    this.reconnectTimer = setTimeout(() => {
      if (this.vestState.deviceId) {
        this.connect(this.vestState.deviceId).catch(() => {
          // Silently retry — user is notified once via state change listener
        });
      }
    }, BLE.VEST_RECONNECT_RETRY_MS);
  }

  private subscribeToSensorData(device: Device): void {
    device.monitorCharacteristicForService(
      BLE.VEST_SERVICE_UUID,
      BLE.VEST_SENSOR_CHAR_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const packet = this.parseSensorPacket(characteristic.value);
        if (packet) {
          this.packetListeners.forEach(l => l(packet.zone, packet.distanceMeters));
        }
      },
    );

    // Poll battery every 60 seconds
    setInterval(() => {
      if (this.device) {
        this.readBattery(this.device).then(battery => {
          this.updateState({ batteryPercent: battery });
        });
      }
    }, 60_000);
  }

  private parseSensorPacket(base64Value: string): { zone: ObstacleZone; distanceMeters: number } | null {
    try {
      const bytes = Buffer.from(base64Value, 'base64');
      if (bytes.length < 3) return null;

      const zoneMap: Record<number, ObstacleZone> = {
        0: 'left',
        1: 'front-left',
        2: 'center',
        3: 'front-right',
        4: 'right',
        5: 'rear-left',
        6: 'rear-right',
      };

      const zoneId = bytes[0];
      const distanceCm = (bytes[1] << 8) | bytes[2];
      const zone = zoneMap[zoneId];
      if (!zone) return null;

      return { zone, distanceMeters: distanceCm / 100 };
    } catch {
      return null;
    }
  }

  async sendHapticCommand(zone: VestHapticZone, pattern: VestHapticPattern): Promise<void> {
    if (!this.device) return;
    try {
      const zoneId = this.zoneToId(zone);
      const patternId = this.patternToId(pattern);
      const payload = Buffer.from([zoneId, patternId]).toString('base64');
      await this.device.writeCharacteristicWithResponseForService(
        BLE.VEST_SERVICE_UUID,
        BLE.VEST_HAPTIC_CHAR_UUID,
        payload,
      );
    } catch {
      // Haptic command failed — non-fatal
    }
  }

  private async readBattery(device: Device): Promise<number> {
    try {
      const char = await device.readCharacteristicForService(
        BLE.VEST_SERVICE_UUID,
        BLE.VEST_BATTERY_CHAR_UUID,
      );
      const bytes = Buffer.from(char.value ?? '', 'base64');
      return bytes[0] ?? 0;
    } catch {
      return 0;
    }
  }

  private updateState(partial: Partial<VestState>): void {
    this.vestState = { ...this.vestState, ...partial };
    this.stateListeners.forEach(l => l(this.vestState));
  }

  private zoneToId(zone: VestHapticZone): number {
    const map: Record<VestHapticZone, number> = {
      left_shoulder: 0, right_shoulder: 1, left_chest: 2, right_chest: 3,
      center_chest: 4, upper_back_left: 5, upper_back_right: 6,
      lower_front_left: 7, lower_front_right: 8, full_torso: 9,
    };
    return map[zone];
  }

  private patternToId(pattern: VestHapticPattern): number {
    const map: Record<VestHapticPattern, number> = {
      single_pulse: 0, double_pulse: 1, rapid_continuous: 2, long_hold: 3,
      compass_rotate: 4, ascending: 5, descending: 6, full_burst: 7,
    };
    return map[pattern];
  }

  getState(): VestState {
    return this.vestState;
  }
}

export const vestService = new VestService();
