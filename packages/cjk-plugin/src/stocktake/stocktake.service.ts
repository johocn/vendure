/**
 * 盘库 Service（规格 §5/§6/§7 后端实现）。
 * - 建任务：一个事务内固化应盘清单（规格 §6.1）
 * - 盘次独占：同一盘次同一时刻仅一个负责人（规格 §3.6）
 * - 批量录入 / 提交 / 取消：状态按纯函数派生，终态不回退
 * 渠道收口：所有自建表查询一律按 String(ctx.channelId) 过滤（硬性 R10）。
 */
import {
    Administrator,
    Channel,
    ID,
    Logger,
    Product,
    ProductVariant,
    RequestContext,
    StockLevel,
    StockLocation,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import { StocktakeLine } from './stocktake-line.entity';
import { StocktakeTask, StocktakeTaskState } from './stocktake-task.entity';
import { StocktakeWave } from './stocktake-wave.entity';
import { StorageBin } from '../storage/storage-bin.entity';
import { StorageZone } from '../storage/storage-zone.entity';
import { VariantStorageBin } from '../storage/variant-storage-bin.entity';
import { TenantMember } from '../tenant/tenant-member.entity';
import {
    buildExpected,
    canTaskTransition,
    canWaveTransition,
    formatTaskCode,
    nextTaskSeq,
    resolveTaskStateAfterWaves,
    resolveWaveStateAfterCount,
    type BindRow,
    type BookRow,
    type StocktakeScope,
    waveOwnerError,
} from './stocktake-math';
import { StockDocService } from '../inventory/stock-doc.service';

export interface StocktakeOperator { id: string | null; name: string | null; }

export interface StocktakeTaskView {
    id: number; code: string; stockLocationId: number; locationName: string | null;
    activityCode: string | null; name: string; scopeJson: string; binModeAtCreate: string;
    state: StocktakeTaskState; createdById: string | null; createdByName: string | null;
    postedStockDocId: number | null; postedAt: Date | null; note: string | null;
    createdAt: Date; expectedTotal: number; countedTotal: number;
    waveCount: number; submittedWaveCount: number;
}

@Injectable()
export class StocktakeService {
    constructor(
        private connection: TransactionalConnection,
        private stockDocService: StockDocService,
    ) {}

    private get repo() {
        return this.connection.rawConnection.getRepository(StocktakeTask);
    }

    /** 渠道收口键（硬性 R10）：与既有 storage-bin.service.ts 的 tenantOf 同源 */
    private tenantOf(ctx: RequestContext): string {
        return String(ctx.channelId);
    }

    /** 当前操作人：优先 TenantMember.displayName，回退 Administrator 姓名（照 pick-batch.admin.resolver 的实现） */
    async currentOperator(ctx: RequestContext): Promise<StocktakeOperator> {
        if (!ctx.activeUserId) return { id: null, name: null };
        try {
            const member = await this.connection.getRepository(ctx, TenantMember).findOne({
                where: { administratorId: String(ctx.activeUserId) },
            });
            if (member) return { id: String(member.id), name: member.displayName || null };
            const admin = await this.connection.getRepository(ctx, Administrator).findOne({
                where: { id: ctx.activeUserId as any },
            });
            if (admin) {
                const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
                return { id: null, name: name || null };
            }
        } catch (e) {
            Logger.warn(`盘库：解析操作人失败 ${(e as Error).message}`, 'Stocktake');
        }
        return { id: null, name: null };
    }

    // ------------------------------------------------------------ 读

    private async buildTaskView(ctx: RequestContext, task: StocktakeTask): Promise<StocktakeTaskView> {
        const waves = await this.connection.getRepository(ctx, StocktakeWave).find({ where: { taskId: Number(task.id) } });
        const lines = await this.connection.getRepository(ctx, StocktakeLine).find({ where: { taskId: Number(task.id) } });
        let locationName: string | null = null;
        try {
            const loc = await this.connection.getRepository(ctx, StockLocation).findOne({ where: { id: task.stockLocationId as any } });
            locationName = loc?.name ?? null;
        } catch { /* 仓库被删 → 不阻塞列表 */ }
        return {
            id: Number(task.id), code: task.code, stockLocationId: task.stockLocationId, locationName,
            activityCode: task.activityCode, name: task.name, scopeJson: task.scopeJson,
            binModeAtCreate: task.binModeAtCreate, state: task.state,
            createdById: task.createdById, createdByName: task.createdByName,
            postedStockDocId: task.postedStockDocId, postedAt: task.postedAt, note: task.note,
            createdAt: task.createdAt,
            expectedTotal: lines.filter((l) => !l.isExtra).length,
            countedTotal: lines.filter((l) => !l.isExtra && l.countedQty !== null).length,
            waveCount: waves.length,
            submittedWaveCount: waves.filter((w) => w.state === 'SUBMITTED').length,
        };
    }

    async listTasks(ctx: RequestContext, options?: any): Promise<{ totalItems: number; items: StocktakeTaskView[] }> {
        const where: any = { tenantChannelId: this.tenantOf(ctx) };
        if (options?.state) where.state = options.state;
        if (options?.activityCode) where.activityCode = options.activityCode;
        if (options?.stockLocationId) where.stockLocationId = Number(options.stockLocationId);
        const page = Number(options?.page) > 0 ? Number(options.page) : 1;
        const pageSize = Math.min(Number(options?.pageSize) > 0 ? Number(options.pageSize) : 20, 100);
        const [tasks, totalItems] = await this.connection.getRepository(ctx, StocktakeTask).findAndCount({
            where, order: { id: 'DESC' }, skip: (page - 1) * pageSize, take: pageSize,
        });
        const items: StocktakeTaskView[] = [];
        for (const t of tasks) items.push(await this.buildTaskView(ctx, t));
        return { totalItems, items };
    }

    async getTask(ctx: RequestContext, id: ID): Promise<StocktakeTaskView | null> {
        const task = await this.assertTask(ctx, id, { allowPosted: true });
        return this.buildTaskView(ctx, task);
    }

    async listWaves(ctx: RequestContext, taskId: ID): Promise<StocktakeWave[]> {
        await this.assertTask(ctx, taskId, { allowPosted: true });
        return this.connection.getRepository(ctx, StocktakeWave).find({
            where: { taskId: Number(taskId) }, order: { id: 'ASC' },
        });
    }

    /** 任务取回 + 渠道收口 + 状态校验（所有写路径共用；越权一律 UserInputError） */
    private async assertTask(ctx: RequestContext, id: ID, opts?: { allowPosted?: boolean }): Promise<StocktakeTask> {
        const task = await this.connection.getRepository(ctx, StocktakeTask).findOne({ where: { id: Number(id) } });
        if (!task) throw new UserInputError(`盘点任务 #${id} 不存在`);
        if (task.tenantChannelId !== this.tenantOf(ctx)) throw new UserInputError(`盘点任务 #${id} 不属于当前店铺`);
        if (!opts?.allowPosted && task.state === 'POSTED') throw new UserInputError(`任务 ${task.code} 已过账，无法再修改`);
        if (!opts?.allowPosted && task.state === 'CANCELLED') throw new UserInputError(`任务 ${task.code} 已取消`);
        return task;
    }

    private async assertWave(ctx: RequestContext, id: ID, opts?: { allowTerminal?: boolean }): Promise<StocktakeWave> {
        const wave = await this.connection.getRepository(ctx, StocktakeWave).findOne({ where: { id: Number(id) } });
        if (!wave) throw new UserInputError(`盘次 #${id} 不存在`);
        if (wave.tenantChannelId !== this.tenantOf(ctx)) throw new UserInputError(`盘次 #${id} 不属于当前店铺`);
        if (!opts?.allowTerminal && (wave.state === 'SUBMITTED' || wave.state === 'CANCELLED')) {
            throw new UserInputError(`盘次 #${id} 已提交或已取消，无法再修改`);
        }
        return wave;
    }

    // ------------------------------------------------------------ 建任务

    /** scope.categoryIds → variantIds（商品数据不在纯函数里碰） */
    private async resolveScopeVariants(ctx: RequestContext, scope: StocktakeScope): Promise<number[]> {
        const variantIds = new Set<number>((scope.variantIds || []).map(Number));
        const categoryIds = (scope.categoryIds || []).map(Number);
        if (categoryIds.length) {
            const products = await this.connection.getRepository(ctx, Product).find({
                relations: { facetValues: true },
                where: { facetValues: { id: In(categoryIds) } } as any,
            });
            const productIds = products.map((p) => p.id as number);
            if (productIds.length) {
                const variants = await this.connection.getRepository(ctx, ProductVariant).find({
                    where: { productId: In(productIds) } as any,
                });
                for (const v of variants) variantIds.add(v.id as number);
            }
        }
        return Array.from(variantIds);
    }

    async createTask(ctx: RequestContext, input: any): Promise<StocktakeTaskView> {
        const tenant = this.tenantOf(ctx);
        const operator = await this.currentOperator(ctx);
        const stockLocationId = Number(input.stockLocationId);
        if (!stockLocationId) throw new UserInputError('请选择盘点仓库');
        if (!input.name || !String(input.name).trim()) throw new UserInputError('请填写任务名称');

        const channel = await this.connection.getRepository(ctx, Channel).findOne({ where: { id: ctx.channelId as any } });
        const binMode = ((channel?.customFields as any)?.binMode || 'off') as 'off' | 'zone' | 'bin';

        const scope: StocktakeScope = {
            zones: (input.scope?.zones || []).map(Number),
            categoryIds: (input.scope?.categoryIds || []).map(Number),
            variantIds: await this.resolveScopeVariants(ctx, {
                zones: [], categoryIds: input.scope?.categoryIds || [], variantIds: input.scope?.variantIds || [],
                includeZeroBook: false,
            }),
            includeZeroBook: !!input.scope?.includeZeroBook,
        };

        // 双源：有账面（stockLevels）+ 已归位（variant_storage_bin）
        const levels = await this.connection.getRepository(ctx, StockLevel).find({
            where: { stockLocationId: stockLocationId as any },
        });
        const bookRows: BookRow[] = levels.map((l) => ({ variantId: Number(l.productVariantId), quantity: l.stockOnHand }));
        const bindEntities = await this.connection.getRepository(ctx, VariantStorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId },
        });
        const zones = await this.connection.getRepository(ctx, StorageZone).find({
            where: { tenantChannelId: tenant, stockLocationId },
        });
        const bins = await this.connection.getRepository(ctx, StorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId },
        });
        const zoneById = new Map(zones.map((z) => [z.id as number, z]));
        const binById = new Map(bins.map((b) => [b.id as number, b]));
        const bindRows: BindRow[] = bindEntities
            .filter((b) => {
                const z = zoneById.get(Number(b.zoneId));
                return !!z && z.enabled && (!b.binId || !!binById.get(Number(b.binId))?.enabled);
            })
            .map((b) => ({
                variantId: Number(b.variantId),
                zoneId: Number(b.zoneId),
                binId: b.binId ? Number(b.binId) : null,
                zoneCode: zoneById.get(Number(b.zoneId))?.code ?? null,
                binCode: b.binId ? binById.get(Number(b.binId))?.code ?? null : null,
            }));

        const variantIds = Array.from(new Set([...bookRows.map((r) => r.variantId), ...bindRows.map((r) => r.variantId)]));
        const variants = variantIds.length
            ? await this.connection.getRepository(ctx, ProductVariant).find({ where: { id: In(variantIds) } })
            : [];
        const variantMeta = new Map(variants.map((v) => [v.id as number, { sku: v.sku, name: v.name || v.sku }]));
        const zoneMeta = new Map(zones.map((z) => [z.id as number, { code: z.code, name: z.name }]));

        const expected = buildExpected({ binMode, bookRows, bindRows, variantMeta, zoneMeta, scope });
        if (!expected.waves.some((w) => w.expectedCount > 0)) {
            throw new UserInputError('该范围下没有可盘的商品（既无账面也无归位记录），请检查圈选条件或仓库');
        }

        return this.connection.withTransaction(ctx, async (txCtx) => {
            const codeList = await this.connection.getRepository(txCtx, StocktakeTask).find({
                where: { tenantChannelId: tenant }, select: ['code'],
            });
            const seq = nextTaskSeq(codeList.map((t) => t.code), new Date());
            const code = formatTaskCode(new Date(), seq);

            const task = await this.connection.getRepository(txCtx, StocktakeTask).save(new StocktakeTask({
                code, tenantChannelId: tenant, stockLocationId,
                activityCode: input.activityCode ? String(input.activityCode).trim() : null,
                name: String(input.name).trim(),
                scopeJson: JSON.stringify(scope),
                binModeAtCreate: binMode,
                state: 'OPEN',
                createdById: operator.id, createdByName: operator.name,
                note: input.note ?? null,
            }));

            for (let i = 0; i < expected.waves.length; i++) {
                const w = expected.waves[i];
                const wave = await this.connection.getRepository(txCtx, StocktakeWave).save(new StocktakeWave({
                    tenantChannelId: tenant, taskId: Number(task.id), scopeType: w.scopeType,
                    zoneId: w.zoneId, zoneCode: w.zoneCode, zoneName: w.zoneName,
                    state: 'OPEN', expectedCount: w.expectedCount, countedCount: 0,
                    assigneeId: null, assigneeName: null, claimedAt: null, submittedAt: null,
                }));
                const rows = expected.linesByWave[i].map((l) => new StocktakeLine({
                    tenantChannelId: tenant, taskId: Number(task.id), waveId: Number(wave.id),
                    variantId: l.variantId, variantSku: l.variantSku, variantName: l.variantName,
                    zoneId: l.zoneId, binId: l.binId, zoneCode: l.zoneCode, binCode: l.binCode,
                    bookQty: l.bookQty, countedQty: null, isExtra: false,
                }));
                if (rows.length) await this.connection.getRepository(txCtx, StocktakeLine).save(rows);
            }
            return this.buildTaskView(txCtx, task);
        });
    }

    // ------------------------------------------------------------ 盘次动作

    async addWave(ctx: RequestContext, taskId: ID, input: any): Promise<StocktakeWave> {
        await this.assertTask(ctx, taskId);
        const scopeType = String(input.scopeType || '');
        if (!['zone', 'whole', 'unassigned'].includes(scopeType)) {
            throw new UserInputError('盘次范围类型不合法（zone / whole / unassigned）');
        }
        if (scopeType === 'zone' && !input.zoneId) throw new UserInputError('按库区拆盘次时必须指定库区');
        // 复用建任务时的清单生成口径：把该范围内尚未落入任何盘次的行补进来
        throw new UserInputError('暂不支持手工补盘次：请在建任务时由系统按库区自动拆分（P1 再开放）');
    }

    async assignWave(ctx: RequestContext, waveId: ID, assigneeId?: string | null): Promise<StocktakeWave> {
        const wave = await this.assertWave(ctx, waveId);
        if (wave.state === 'COUNTING' && assigneeId && String(assigneeId) !== String(wave.assigneeId)) {
            throw new UserInputError('该盘次已开始录入，无法改派；请先释放再由新负责人认领');
        }
        if (!assigneeId) return this.releaseWave(ctx, waveId);
        const member = await this.connection.getRepository(ctx, TenantMember).findOne({
            where: { id: Number(assigneeId) } as any,
        });
        if (!member || member.channelId !== this.tenantOf(ctx)) throw new UserInputError('指定的负责人不存在或不属于当前店铺');
        wave.assigneeId = String(member.id);
        wave.assigneeName = member.displayName || null;
        wave.claimedAt = wave.claimedAt ?? new Date();
        if (wave.state === 'OPEN') wave.state = 'CLAIMED';
        this.connection.getRepository(ctx, StocktakeWave).save(wave);
        return wave;
    }

    async claimWave(ctx: RequestContext, waveId: ID): Promise<StocktakeWave> {
        const wave = await this.assertWave(ctx, waveId);
        const operator = await this.currentOperator(ctx);
        if (!operator.id) throw new UserInputError('当前账号不是本店人员，无法认领盘次');
        if (wave.assigneeId) {
            if (String(wave.assigneeId) === String(operator.id)) return wave; // 幂等
            throw new UserInputError(`该盘次已被 ${wave.assigneeName || '其他人员'} 认领`);
        }
        wave.assigneeId = operator.id;
        wave.assigneeName = operator.name;
        wave.claimedAt = new Date();
        if (wave.state === 'OPEN') wave.state = 'CLAIMED';
        return this.connection.getRepository(ctx, StocktakeWave).save(wave);
    }

    async releaseWave(ctx: RequestContext, waveId: ID): Promise<StocktakeWave> {
        const wave = await this.assertWave(ctx, waveId);
        const operator = await this.currentOperator(ctx);
        const err = waveOwnerError(wave.assigneeId, operator.id, wave.assigneeName);
        if (err) throw new UserInputError(err);
        wave.assigneeId = null;
        wave.assigneeName = null;
        wave.claimedAt = null;
        wave.state = 'OPEN';
        return this.connection.getRepository(ctx, StocktakeWave).save(wave);
    }

    async cancelWave(ctx: RequestContext, waveId: ID): Promise<StocktakeWave> {
        const wave = await this.assertWave(ctx, waveId);
        if (!canWaveTransition(wave.state, 'CANCELLED')) throw new UserInputError(`盘次当前状态 ${wave.state} 不可取消`);
        wave.state = 'CANCELLED';
        const saved = await this.connection.getRepository(ctx, StocktakeWave).save(wave);
        await this.syncTaskState(ctx, wave.taskId);
        return saved;
    }

    async cancelTask(ctx: RequestContext, taskId: ID): Promise<StocktakeTaskView> {
        const task = await this.assertTask(ctx, taskId);
        if (!canTaskTransition(task.state, 'CANCELLED')) throw new UserInputError(`任务当前状态 ${task.state} 不可取消`);
        task.state = 'CANCELLED';
        const saved = await this.connection.getRepository(ctx, StocktakeTask).save(task);
        const waves = await this.connection.getRepository(ctx, StocktakeWave).find({ where: { taskId: Number(task.id) } });
        for (const w of waves) {
            if (w.state !== 'SUBMITTED' && w.state !== 'CANCELLED') {
                w.state = 'CANCELLED';
                await this.connection.getRepository(ctx, StocktakeWave).save(w);
            }
        }
        return this.buildTaskView(ctx, saved);
    }

    /** 盘次集合变化后同步任务状态 */
    private async syncTaskState(ctx: RequestContext, taskId: number): Promise<StocktakeTaskState> {
        const task = await this.connection.getRepository(ctx, StocktakeTask).findOne({ where: { id: taskId } });
        if (!task) throw new UserInputError(`盘点任务 #${taskId} 不存在`);
        const waves = await this.connection.getRepository(ctx, StocktakeWave).find({ where: { taskId } });
        const next = resolveTaskStateAfterWaves(task.state, waves);
        if (next !== task.state) {
            task.state = next;
            await this.connection.getRepository(ctx, StocktakeTask).save(task);
        }
        return task.state;
    }

    // ------------------------------------------------------------ 录入

    async saveCounts(ctx: RequestContext, waveId: ID, inputs: any[]): Promise<StocktakeWave> {
        const wave = await this.assertWave(ctx, waveId);
        const operator = await this.currentOperator(ctx);
        const ownerErr = waveOwnerError(wave.assigneeId, operator.id, wave.assigneeName);
        if (ownerErr) throw new UserInputError(ownerErr);
        if (!Array.isArray(inputs) || !inputs.length) throw new UserInputError('请提交至少一行盘点数量');

        const task = await this.assertTask(ctx, wave.taskId);

        return this.connection.withTransaction(ctx, async (txCtx) => {
            const lines = await this.connection.getRepository(txCtx, StocktakeLine).find({ where: { waveId: Number(wave.id) } });
            const byId = new Map(lines.map((l) => [l.id as number, l]));
            const byVariant = new Map<number, StocktakeLine[]>();
            for (const l of lines) {
                const list = byVariant.get(Number(l.variantId)) || [];
                list.push(l);
                byVariant.set(Number(l.variantId), list);
            }

            for (const item of inputs) {
                const qty = Number(item.countedQty);
                if (!Number.isFinite(qty) || qty < 0) throw new UserInputError('盘点数量必须是不小于 0 的整数');
                let target: StocktakeLine | undefined;
                if (item.lineId) {
                    target = byId.get(Number(item.lineId));
                    if (!target) throw new UserInputError(`应盘行 #${item.lineId} 不属于本次盘次`);
                } else if (item.variantId) {
                    // 扫到已在清单内的变体 → 更新原行（规格 §6.2 配套规则：不新建行）
                    const same = byVariant.get(Number(item.variantId)) || [];
                    const binId = item.binId ? Number(item.binId) : null;
                    target = same.find((l) => (l.binId ?? null) === binId) || same[0];
                }
                if (!target) {
                    // 完全清单外 → 建盘盈行（isExtra=true，账面按 0）
                    const variantId = Number(item.variantId);
                    if (!variantId) throw new UserInputError('清单外登记必须提供商品（variantId）');
                    const variant = await this.connection.getRepository(txCtx, ProductVariant).findOne({ where: { id: variantId } });
                    if (!variant) throw new UserInputError(`商品 #${variantId} 不存在`);
                    target = new StocktakeLine({
                        tenantChannelId: this.tenantOf(ctx), taskId: Number(task.id), waveId: Number(wave.id),
                        variantId, variantSku: variant.sku, variantName: variant.name || variant.sku,
                        zoneId: item.zoneId ? Number(item.zoneId) : null, binId: item.binId ? Number(item.binId) : null,
                        zoneCode: null, binCode: null, bookQty: 0, isExtra: true,
                    });
                }
                target.countedQty = Math.floor(qty);
                target.countedById = operator.id;
                target.countedByName = operator.name;
                target.countedAt = new Date();
                if (item.note !== undefined) target.note = item.note ?? null;
                if (item.zoneId) target.zoneId = Number(item.zoneId);
                if (item.binId) target.binId = Number(item.binId);
                await this.connection.getRepository(txCtx, StocktakeLine).save(target);
            }

            const fresh = await this.connection.getRepository(txCtx, StocktakeLine).find({ where: { waveId: Number(wave.id) } });
            wave.countedCount = fresh.filter((l) => l.countedQty !== null).length;
            wave.state = resolveWaveStateAfterCount(wave.state, wave.countedCount);
            await this.connection.getRepository(txCtx, StocktakeWave).save(wave);
            await this.syncTaskState(txCtx, wave.taskId);
            return wave;
        });
    }

    async submitWave(ctx: RequestContext, waveId: ID): Promise<StocktakeWave> {
        const wave = await this.assertWave(ctx, waveId);
        const operator = await this.currentOperator(ctx);
        const ownerErr = waveOwnerError(wave.assigneeId, operator.id, wave.assigneeName);
        if (ownerErr) throw new UserInputError(ownerErr);
        if (!canWaveTransition(wave.state, 'SUBMITTED')) throw new UserInputError(`盘次当前状态 ${wave.state} 不可提交`);
        wave.state = 'SUBMITTED';
        wave.submittedAt = new Date();
        const saved = await this.connection.getRepository(ctx, StocktakeWave).save(wave);
        await this.syncTaskState(ctx, wave.taskId);
        return saved;
    }
}