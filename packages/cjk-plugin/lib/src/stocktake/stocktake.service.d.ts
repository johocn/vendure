/**
 * 盘库 Service（规格 §5/§6/§7 后端实现）。
 * - 建任务：一个事务内固化应盘清单（规格 §6.1）
 * - 盘次独占：同一盘次同一时刻仅一个负责人（规格 §3.6）
 * - 批量录入 / 提交 / 取消：状态按纯函数派生，终态不回退
 * 渠道收口：所有自建表查询一律按 String(ctx.channelId) 过滤（硬性 R10）。
 */
import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { StocktakeTaskState } from './stocktake-task.entity';
import { StocktakeWave } from './stocktake-wave.entity';
import { StockDocService } from '../inventory/stock-doc.service';
export interface StocktakeOperator {
    id: string | null;
    name: string | null;
}
export interface StocktakeTaskView {
    id: number;
    code: string;
    stockLocationId: number;
    locationName: string | null;
    activityCode: string | null;
    name: string;
    scopeJson: string;
    binModeAtCreate: string;
    state: StocktakeTaskState;
    createdById: string | null;
    createdByName: string | null;
    postedStockDocId: number | null;
    postedAt: Date | null;
    note: string | null;
    createdAt: Date;
    expectedTotal: number;
    countedTotal: number;
    waveCount: number;
    submittedWaveCount: number;
}
export declare class StocktakeService {
    private connection;
    private stockDocService;
    constructor(connection: TransactionalConnection, stockDocService: StockDocService);
    private get repo();
    /** 渠道收口键（硬性 R10）：与既有 storage-bin.service.ts 的 tenantOf 同源 */
    private tenantOf;
    /** 当前操作人：优先 TenantMember.displayName，回退 Administrator 姓名（照 pick-batch.admin.resolver 的实现） */
    currentOperator(ctx: RequestContext): Promise<StocktakeOperator>;
    private buildTaskView;
    listTasks(ctx: RequestContext, options?: any): Promise<{
        totalItems: number;
        items: StocktakeTaskView[];
    }>;
    getTask(ctx: RequestContext, id: ID): Promise<StocktakeTaskView | null>;
    listWaves(ctx: RequestContext, taskId: ID): Promise<StocktakeWave[]>;
    /** 任务取回 + 渠道收口 + 状态校验（所有写路径共用；越权一律 UserInputError） */
    private assertTask;
    private assertWave;
    /** scope.categoryIds → variantIds（商品数据不在纯函数里碰） */
    private resolveScopeVariants;
    createTask(ctx: RequestContext, input: any): Promise<StocktakeTaskView>;
    addWave(ctx: RequestContext, taskId: ID, input: any): Promise<StocktakeWave>;
    assignWave(ctx: RequestContext, waveId: ID, assigneeId?: string | null): Promise<StocktakeWave>;
    claimWave(ctx: RequestContext, waveId: ID): Promise<StocktakeWave>;
    releaseWave(ctx: RequestContext, waveId: ID): Promise<StocktakeWave>;
    cancelWave(ctx: RequestContext, waveId: ID): Promise<StocktakeWave>;
    cancelTask(ctx: RequestContext, taskId: ID): Promise<StocktakeTaskView>;
    /** 盘次集合变化后同步任务状态 */
    private syncTaskState;
    saveCounts(ctx: RequestContext, waveId: ID, inputs: any[]): Promise<StocktakeWave>;
    submitWave(ctx: RequestContext, waveId: ID): Promise<StocktakeWave>;
}
