import { RequestContext } from '@vendure/core';
import { PosTerminal } from '../entities/pos-terminal.entity';
import { PosTerminalService } from '../services/pos-terminal.service';
export declare class AdminTerminalResolver {
    private terminalService;
    constructor(terminalService: PosTerminalService);
    posTerminals(ctx: RequestContext, channelId?: string): Promise<PosTerminal[]>;
    posTerminal(id: string): Promise<PosTerminal | null>;
    createPosTerminal(input: any, ctx: RequestContext): Promise<PosTerminal>;
    updatePosTerminal(input: any): Promise<PosTerminal>;
    deletePosTerminal(id: string): Promise<boolean>;
}
