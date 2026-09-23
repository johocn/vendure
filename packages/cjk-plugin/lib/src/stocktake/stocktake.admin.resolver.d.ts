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
    createStocktakeTask(ctx: RequestContext, args: any): Promise<import("./stocktake.service").StocktakeTaskView>;
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
