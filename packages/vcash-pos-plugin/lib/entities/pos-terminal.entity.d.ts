import { Channel, StockLocation } from '@vendure/core';
export type PosDeviceConfig = {
    printerVendorId?: string;
    printerProductId?: string;
    scaleBaudRate?: number;
    scaleProtocol?: 'continuous' | 'polling';
    cashDrawerViaPrinter?: boolean;
    paperWidth?: 58 | 80;
};
export declare class PosTerminal {
    id: number;
    code: string;
    name: string;
    channel: Channel;
    stockLocation: StockLocation;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    deviceConfig: PosDeviceConfig | null;
}
