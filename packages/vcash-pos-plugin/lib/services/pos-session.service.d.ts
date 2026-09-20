import { Connection } from 'typeorm';
import { PosSession, ShiftSummary } from '../entities/pos-session.entity';
import { PosTerminalService } from './pos-terminal.service';
import { ShiftReportService } from './shift-report.service';
/**
 * 班次生命周期服务：
 * - 开班：校验终端 active + 无 open session → 生成 session code → 持久化
 * - 关班：校验 session open → 调用 ShiftReportService 生成 closeSummary → 标记 closed
 * - 查询：findOpenSession / findMySession / findOne
 *
 * closeSession 若未显式传入 closeSummary，则调用 ShiftReportService 自动生成。
 */
export declare class PosSessionService {
    private connection;
    private terminalService;
    private shiftReportService;
    constructor(connection: Connection, terminalService: PosTerminalService, shiftReportService: ShiftReportService);
    /**
     * 开班。同一终端同时仅允许一个 open 状态 session。
     */
    openSession(input: {
        terminalCode: string;
        operatorId: number;
        openingFloat?: number;
    }): Promise<PosSession>;
    /**
     * 关班。若未显式传入 closeSummary，则调用 ShiftReportService 自动生成
     * （会基于 closingCash 进行现金对账并产出 warnings）。
     */
    closeSession(input: {
        sessionId: number;
        closingCash?: number;
        approverId?: number;
        closeSummary?: ShiftSummary | null;
    }): Promise<PosSession>;
    findOpenSession(terminalId: number): Promise<PosSession | null>;
    findMyOpenSession(operatorId: number): Promise<PosSession | null>;
    findOne(id: number): Promise<PosSession | null>;
    /**
     * 保存 session 变更（绑定/解绑会员、activeOrderId 变更等）。
     */
    save(session: PosSession): Promise<PosSession>;
    /**
     * 生成班次号：S{YYYYMMDD}-{3位序号}。序号按当天已有 session 数 +1 推算。
     */
    private generateSessionCode;
}
