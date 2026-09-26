/**
 * 盘库 Service（规格 §5/§6/§7 后端实现）。
 * - 建任务：一个事务内固化应盘清单（规格 §6.1）
 * - 盘次独占：同一盘次同一时刻仅一个负责人（规格 §3.6）
 * - 批量录入 / 提交 / 取消：状态按纯函数派生，终态不回退
 * 渠道收口：所有自建表查询一律按 String(ctx.channelId) 过滤（硬性 R10）。
 */
import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { StocktakeLine } from './stocktake-line.entity';
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
    /** 当前操作人：优先 TenantMember.displayName，回退 Administrator 姓名
     *  （D45 修正键错位：ctx.activeUserId 是 User.id，而 TenantMember.administratorId 存的是
     *    Administrator.id —— 必须先经 Administrator.userId 换键，与 tenant-member.service.memberToView
     *    的 canonical 写法同源；否则 Administrator.id ≠ User.id 的账号恒回 {id:null}，
     *    认领盘次直接报「当前账号不是本店人员」，整条录入→提交→过账链路不可用。） */
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
    /** 任务头落库（草稿与直接创建共用；DRAFT 不物化盘次与应盘行） */
    private buildTaskHead;
    /** 默认档位（渠道 customFields.binMode；缺省 off） */
    private currentBinMode;
    /**
     * 物化：解析范围 → 双源合并 → 建盘次与应盘行（规格 §7.2）。
     * 直接创建与「草稿发布」共用；必须在一个事务内调用（txCtx）。
     */
    private materializeTask;
    createTask(ctx: RequestContext, input: any): Promise<StocktakeTaskView>;
    /** 草稿发布（规格 §3.2 / §5）：仅 DRAFT 可发；发布时才物化盘次与应盘行 */
    openTask(ctx: RequestContext, taskId: ID): Promise<StocktakeTaskView>;
    /** 草稿编辑（规格 §5）：仅 DRAFT 可改；状态不经此路径变更 */
    updateTask(ctx: RequestContext, taskId: ID, input: any): Promise<StocktakeTaskView>;
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
    /** 统计输入行投影（纯函数入参，规格 §7.3） */
    private statLinesOf;
    /** 作业量统计（规格 §6.3）：DRAFT / 零行任务返回空结构，不报错 */
    statsOf(ctx: RequestContext, taskId: ID): Promise<{
        expectedLines: number;
        countedLines: number;
        byBin: import("./stocktake-math").BinStat[];
        byCounter: import("./stocktake-math").CounterStat[];
    }>;
    /**
     * 全量导出（规格 §6.4 / §7.4）：后端只出 CSV（不引 exceljs/xlsx，守部署铁律）。
     * 四个 kind 与前端「当前视图导出」共用同一份列定义；行数超上限即截断并标记。
     */
    exportOf(ctx: RequestContext, taskId: ID, kind: string): Promise<{
        filename: string;
        mimeType: string;
        content: string;
        totalRows: number;
        truncated: boolean;
    }>;
    /** 读当前账面（StockLevel）+ 当前绑定（variant_storage_bin）→ 差异汇总 */
    private loadCurrentState;
    diffOf(ctx: RequestContext, taskId: ID): Promise<{
        summary: import("./stocktake-math").VarianceSummary;
        rows: {
            variantId: string;
            variantSku: string;
            variantName: string;
            countedTotal: number;
            bookQty: number;
            diff: number;
            isExtra: boolean;
            binChanged: boolean;
            targetZoneId: string | null;
            targetBinId: string | null;
            targetBinCode: string | null;
            targetZoneCode: string | null;
            snapBookQty: number;
            currentBookQty: number;
        }[];
        uncountedLines: StocktakeLine[];
        changedVariants: {
            variantId: string;
            variantSku: string;
            snapBookQty: number;
            currentBookQty: number;
        }[];
    }>;
    post(ctx: RequestContext, taskId: ID, confirm?: boolean): Promise<{
        ok: boolean;
        stockDocId: string;
        diff: {
            summary: import("./stocktake-math").VarianceSummary;
            rows: {
                variantId: string;
                variantSku: string;
                variantName: string;
                countedTotal: number;
                bookQty: number;
                diff: number;
                isExtra: boolean;
                binChanged: boolean;
                targetZoneId: string | null;
                targetBinId: string | null;
                targetBinCode: string | null;
                targetZoneCode: string | null;
                snapBookQty: number;
                currentBookQty: number;
            }[];
            uncountedLines: StocktakeLine[];
            changedVariants: {
                variantId: string;
                variantSku: string;
                snapBookQty: number;
                currentBookQty: number;
            }[];
        };
        message: string;
    } | {
        ok: boolean;
        stockDocId: null;
        diff: {
            summary: import("./stocktake-math").VarianceSummary;
            rows: {
                variantId: string;
                variantSku: string;
                variantName: string;
                countedTotal: number;
                bookQty: number;
                diff: number;
                isExtra: boolean;
                binChanged: boolean;
                targetZoneId: string | null;
                targetBinId: string | null;
                targetBinCode: string | null;
                targetZoneCode: string | null;
                snapBookQty: number;
                currentBookQty: number;
            }[];
            uncountedLines: StocktakeLine[];
            changedVariants: {
                variantId: string;
                variantSku: string;
                snapBookQty: number;
                currentBookQty: number;
            }[];
        };
        message: string;
    }>;
    /** 应盘行分页 + 已盘/未盘/差异/盘盈筛选 */
    listLines(ctx: RequestContext, args: any): Promise<{
        totalItems: number;
        items: StocktakeLine[];
    }>;
    /** 扫码解析：库位码 / 任务内应盘行 / 清单外变体（规格 §7/§8.3） */
    resolveCode(ctx: RequestContext, taskId: ID, code: string): Promise<{
        kind: "line" | "bin" | "extra";
        binId: string | null;
        binCode: string | null;
        zoneId: string | null;
        lineId: string | null;
        variantId: string | null;
        variantSku: string | null;
        variantName: string | null;
        message: null;
    } | {
        kind: string;
        binId: null;
        binCode: null;
        zoneId: null;
        lineId: null;
        variantId: string;
        variantSku: string;
        variantName: string;
        message: string;
    } | {
        kind: string;
        binId: null;
        binCode: null;
        zoneId: null;
        lineId: null;
        variantId: null;
        variantSku: null;
        variantName: null;
        message: string;
    }>;
}
