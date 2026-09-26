import { RequestContext, TransactionalConnection } from '@vendure/core';
import { StocktakeService } from './stocktake.service';
export declare class StocktakeAdminResolver {
    private stocktakeService;
    private connection;
    constructor(stocktakeService: StocktakeService, connection: TransactionalConnection);
    stocktakeTasks(ctx: RequestContext, args: any): Promise<{
        totalItems: number;
        items: import("./stocktake.service").StocktakeTaskView[];
    }>;
    stocktakeTask(ctx: RequestContext, args: any): Promise<import("./stocktake.service").StocktakeTaskView | null>;
    /** 看板盘库 KPI 聚合（D48）：窗口判定与差异聚合都在服务端，绕开 listTasks 的 pageSize ≤ 100 硬上限 */
    stocktakeKpi(ctx: RequestContext, from?: string, to?: string): Promise<import("./stocktake.service").StocktakeKpi>;
    stocktakeWaves(ctx: RequestContext, args: any): Promise<import("./stocktake-wave.entity").StocktakeWave[]>;
    stocktakeExpectedLines(ctx: RequestContext, args: any): Promise<{
        totalItems: number;
        items: import("./stocktake-line.entity").StocktakeLine[];
    }>;
    stocktakeDiff(ctx: RequestContext, args: any): Promise<{
        expectedTotal: any;
        countedTotal: any;
        uncountedCount: any;
        extraCount: any;
        diffCount: any;
        rows: any;
        uncountedLines: any;
        recheck: any;
        changedVariants: any;
    }>;
    stocktakeResolveCode(ctx: RequestContext, args: any): Promise<{
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
    stocktakeStats(ctx: RequestContext, args: any): Promise<{
        expectedLines: number;
        countedLines: number;
        byBin: import("./stocktake-math").BinStat[];
        byCounter: import("./stocktake-math").CounterStat[];
    }>;
    stocktakeExport(ctx: RequestContext, args: any): Promise<{
        filename: string;
        mimeType: string;
        content: string;
        totalRows: number;
        truncated: boolean;
    }>;
    createStocktakeTask(ctx: RequestContext, args: any): Promise<import("./stocktake.service").StocktakeTaskView>;
    openStocktakeTask(ctx: RequestContext, args: any): Promise<import("./stocktake.service").StocktakeTaskView>;
    updateStocktakeTask(ctx: RequestContext, args: any): Promise<import("./stocktake.service").StocktakeTaskView>;
    addStocktakeWave(ctx: RequestContext, args: any): Promise<import("./stocktake-wave.entity").StocktakeWave>;
    assignStocktakeWave(ctx: RequestContext, args: any): Promise<import("./stocktake-wave.entity").StocktakeWave>;
    claimStocktakeWave(ctx: RequestContext, args: any): Promise<import("./stocktake-wave.entity").StocktakeWave>;
    releaseStocktakeWave(ctx: RequestContext, args: any): Promise<import("./stocktake-wave.entity").StocktakeWave>;
    saveStocktakeCounts(ctx: RequestContext, args: any): Promise<import("./stocktake-wave.entity").StocktakeWave>;
    submitStocktakeWave(ctx: RequestContext, args: any): Promise<import("./stocktake-wave.entity").StocktakeWave>;
    postStocktake(ctx: RequestContext, args: any): Promise<{
        diff: {
            expectedTotal: any;
            countedTotal: any;
            uncountedCount: any;
            extraCount: any;
            diffCount: any;
            rows: any;
            uncountedLines: any;
            recheck: any;
            changedVariants: any;
        } | null;
        ok: boolean;
        stockDocId: string;
        message: string;
    } | {
        diff: {
            expectedTotal: any;
            countedTotal: any;
            uncountedCount: any;
            extraCount: any;
            diffCount: any;
            rows: any;
            uncountedLines: any;
            recheck: any;
            changedVariants: any;
        } | null;
        ok: boolean;
        stockDocId: null;
        message: string;
    }>;
    cancelStocktakeTask(ctx: RequestContext, args: any): Promise<import("./stocktake.service").StocktakeTaskView>;
    cancelStocktakeWave(ctx: RequestContext, args: any): Promise<import("./stocktake-wave.entity").StocktakeWave>;
}
