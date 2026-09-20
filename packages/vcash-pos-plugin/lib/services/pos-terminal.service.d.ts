import { Connection } from 'typeorm';
import { PosTerminal, PosDeviceConfig } from '../entities/pos-terminal.entity';
export declare class PosTerminalService {
    private connection;
    constructor(connection: Connection);
    findAll(channelId?: number): Promise<PosTerminal[]>;
    findOne(id: number): Promise<PosTerminal | null>;
    findByCode(code: string): Promise<PosTerminal | null>;
    create(input: {
        code: string;
        name: string;
        channelId: number;
        stockLocationId: number;
        deviceConfig?: PosDeviceConfig | null;
    }): Promise<PosTerminal>;
    update(id: number, input: {
        name?: string;
        stockLocationId?: number;
        active?: boolean;
        deviceConfig?: PosDeviceConfig | null;
    }): Promise<PosTerminal>;
    delete(id: number): Promise<boolean>;
}
