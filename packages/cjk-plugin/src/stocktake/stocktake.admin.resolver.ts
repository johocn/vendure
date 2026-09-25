import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, TransactionalConnection } from '@vendure/core';

import { StocktakeService } from './stocktake.service';

/** 差异视图：service 返回 { summary, rows, ... }，SDL 要扁平字段，故此处统一映射 */
function toDiffView(d: any) {
    return {
        expectedTotal: d.summary.expectedTotal,
        countedTotal: d.summary.countedLineCount,
        uncountedCount: d.summary.uncountedCount,
        extraCount: d.summary.extraCount,
        diffCount: d.summary.byVariant.filter((v: any) => v.diff !== 0).length,
        rows: d.rows,
        uncountedLines: d.uncountedLines,
        recheck: d.summary.recheck,
        changedVariants: d.changedVariants,
    };
}

@Resolver()
export class StocktakeAdminResolver {
    constructor(
        private stocktakeService: StocktakeService,
        private connection: TransactionalConnection,
    ) {}

    // ---------------------------------------------------------- 查询

    @Query()
    @Allow(Permission.ReadCatalog)
    async stocktakeTasks(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.listTasks(ctx, args.options);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async stocktakeTask(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.getTask(ctx, args.id);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async stocktakeWaves(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.listWaves(ctx, args.taskId);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async stocktakeExpectedLines(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.listLines(ctx, args);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async stocktakeDiff(@Ctx() ctx: RequestContext, @Args() args: any) {
        return toDiffView(await this.stocktakeService.diffOf(ctx, args.taskId));
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async stocktakeResolveCode(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.resolveCode(ctx, args.taskId, args.code);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async stocktakeStats(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.statsOf(ctx, args.taskId);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async stocktakeExport(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.exportOf(ctx, args.taskId, String(args.kind));
    }

    // ---------------------------------------------------------- 变更

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async createStocktakeTask(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.createTask(ctx, args.input);
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async openStocktakeTask(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.openTask(ctx, args.taskId);
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async updateStocktakeTask(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.updateTask(ctx, args.taskId, args.input);
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async addStocktakeWave(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.addWave(ctx, args.taskId, args.input);
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async assignStocktakeWave(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.assignWave(ctx, args.waveId, args.assigneeId);
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async claimStocktakeWave(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.claimWave(ctx, args.waveId);
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async releaseStocktakeWave(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.releaseWave(ctx, args.waveId);
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async saveStocktakeCounts(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.saveCounts(ctx, args.waveId, args.inputs);
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async submitStocktakeWave(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.submitWave(ctx, args.waveId);
    }

    @Mutation()
    @Allow('StocktakePost' as Permission)
    async postStocktake(@Ctx() ctx: RequestContext, @Args() args: any) {
        const r = await this.stocktakeService.post(ctx, args.taskId, args.confirm);
        return { ...r, diff: r.diff ? toDiffView(r.diff) : null };
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async cancelStocktakeTask(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.cancelTask(ctx, args.taskId);
    }

    @Mutation()
    @Allow('StocktakeCount' as Permission)
    async cancelStocktakeWave(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.stocktakeService.cancelWave(ctx, args.waveId);
    }
}