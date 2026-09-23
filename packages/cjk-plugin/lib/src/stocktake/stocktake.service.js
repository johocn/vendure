"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StocktakeService = void 0;
/**
 * 盘库 Service（规格 §5/§6/§7 后端实现）。
 * - 建任务：一个事务内固化应盘清单（规格 §6.1）
 * - 盘次独占：同一盘次同一时刻仅一个负责人（规格 §3.6）
 * - 批量录入 / 提交 / 取消：状态按纯函数派生，终态不回退
 * 渠道收口：所有自建表查询一律按 String(ctx.channelId) 过滤（硬性 R10）。
 */
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const stocktake_line_entity_1 = require("./stocktake-line.entity");
const stocktake_task_entity_1 = require("./stocktake-task.entity");
const stocktake_wave_entity_1 = require("./stocktake-wave.entity");
const storage_bin_entity_1 = require("../storage/storage-bin.entity");
const storage_zone_entity_1 = require("../storage/storage-zone.entity");
const variant_storage_bin_entity_1 = require("../storage/variant-storage-bin.entity");
const tenant_member_entity_1 = require("../tenant/tenant-member.entity");
const stocktake_math_1 = require("./stocktake-math");
const stock_doc_service_1 = require("../inventory/stock-doc.service");
let StocktakeService = class StocktakeService {
    constructor(connection, stockDocService) {
        this.connection = connection;
        this.stockDocService = stockDocService;
    }
    get repo() {
        return this.connection.rawConnection.getRepository(stocktake_task_entity_1.StocktakeTask);
    }
    /** 渠道收口键（硬性 R10）：与既有 storage-bin.service.ts 的 tenantOf 同源 */
    tenantOf(ctx) {
        return String(ctx.channelId);
    }
    /** 当前操作人：优先 TenantMember.displayName，回退 Administrator 姓名（照 pick-batch.admin.resolver 的实现） */
    async currentOperator(ctx) {
        if (!ctx.activeUserId)
            return { id: null, name: null };
        try {
            const member = await this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember).findOne({
                where: { administratorId: String(ctx.activeUserId) },
            });
            if (member)
                return { id: String(member.id), name: member.displayName || null };
            const admin = await this.connection.getRepository(ctx, core_1.Administrator).findOne({
                where: { id: ctx.activeUserId },
            });
            if (admin) {
                const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
                return { id: null, name: name || null };
            }
        }
        catch (e) {
            core_1.Logger.warn(`盘库：解析操作人失败 ${e.message}`, 'Stocktake');
        }
        return { id: null, name: null };
    }
    // ------------------------------------------------------------ 读
    async buildTaskView(ctx, task) {
        var _a;
        const waves = await this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).find({ where: { taskId: Number(task.id) } });
        const lines = await this.connection.getRepository(ctx, stocktake_line_entity_1.StocktakeLine).find({ where: { taskId: Number(task.id) } });
        let locationName = null;
        try {
            const loc = await this.connection.getRepository(ctx, core_1.StockLocation).findOne({ where: { id: task.stockLocationId } });
            locationName = (_a = loc === null || loc === void 0 ? void 0 : loc.name) !== null && _a !== void 0 ? _a : null;
        }
        catch ( /* 仓库被删 → 不阻塞列表 */_b) { /* 仓库被删 → 不阻塞列表 */ }
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
    async listTasks(ctx, options) {
        const where = { tenantChannelId: this.tenantOf(ctx) };
        if (options === null || options === void 0 ? void 0 : options.state)
            where.state = options.state;
        if (options === null || options === void 0 ? void 0 : options.activityCode)
            where.activityCode = options.activityCode;
        if (options === null || options === void 0 ? void 0 : options.stockLocationId)
            where.stockLocationId = Number(options.stockLocationId);
        const page = Number(options === null || options === void 0 ? void 0 : options.page) > 0 ? Number(options.page) : 1;
        const pageSize = Math.min(Number(options === null || options === void 0 ? void 0 : options.pageSize) > 0 ? Number(options.pageSize) : 20, 100);
        const [tasks, totalItems] = await this.connection.getRepository(ctx, stocktake_task_entity_1.StocktakeTask).findAndCount({
            where, order: { id: 'DESC' }, skip: (page - 1) * pageSize, take: pageSize,
        });
        const items = [];
        for (const t of tasks)
            items.push(await this.buildTaskView(ctx, t));
        return { totalItems, items };
    }
    async getTask(ctx, id) {
        const task = await this.assertTask(ctx, id, { allowPosted: true });
        return this.buildTaskView(ctx, task);
    }
    async listWaves(ctx, taskId) {
        await this.assertTask(ctx, taskId, { allowPosted: true });
        return this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).find({
            where: { taskId: Number(taskId) }, order: { id: 'ASC' },
        });
    }
    /** 任务取回 + 渠道收口 + 状态校验（所有写路径共用；越权一律 UserInputError） */
    async assertTask(ctx, id, opts) {
        const task = await this.connection.getRepository(ctx, stocktake_task_entity_1.StocktakeTask).findOne({ where: { id: Number(id) } });
        if (!task)
            throw new core_1.UserInputError(`盘点任务 #${id} 不存在`);
        if (task.tenantChannelId !== this.tenantOf(ctx))
            throw new core_1.UserInputError(`盘点任务 #${id} 不属于当前店铺`);
        if (!(opts === null || opts === void 0 ? void 0 : opts.allowPosted) && task.state === 'POSTED')
            throw new core_1.UserInputError(`任务 ${task.code} 已过账，无法再修改`);
        if (!(opts === null || opts === void 0 ? void 0 : opts.allowPosted) && task.state === 'CANCELLED')
            throw new core_1.UserInputError(`任务 ${task.code} 已取消`);
        return task;
    }
    async assertWave(ctx, id, opts) {
        const wave = await this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).findOne({ where: { id: Number(id) } });
        if (!wave)
            throw new core_1.UserInputError(`盘次 #${id} 不存在`);
        if (wave.tenantChannelId !== this.tenantOf(ctx))
            throw new core_1.UserInputError(`盘次 #${id} 不属于当前店铺`);
        if (!(opts === null || opts === void 0 ? void 0 : opts.allowTerminal) && (wave.state === 'SUBMITTED' || wave.state === 'CANCELLED')) {
            throw new core_1.UserInputError(`盘次 #${id} 已提交或已取消，无法再修改`);
        }
        return wave;
    }
    // ------------------------------------------------------------ 建任务
    /** scope.categoryIds → variantIds（商品数据不在纯函数里碰） */
    async resolveScopeVariants(ctx, scope) {
        const variantIds = new Set((scope.variantIds || []).map(Number));
        const categoryIds = (scope.categoryIds || []).map(Number);
        if (categoryIds.length) {
            const products = await this.connection.getRepository(ctx, core_1.Product).find({
                relations: { facetValues: true },
                where: { facetValues: { id: (0, typeorm_1.In)(categoryIds) } },
            });
            const productIds = products.map((p) => p.id);
            if (productIds.length) {
                const variants = await this.connection.getRepository(ctx, core_1.ProductVariant).find({
                    where: { productId: (0, typeorm_1.In)(productIds) },
                });
                for (const v of variants)
                    variantIds.add(v.id);
            }
        }
        return Array.from(variantIds);
    }
    async createTask(ctx, input) {
        var _a, _b, _c, _d, _e, _f;
        const tenant = this.tenantOf(ctx);
        const operator = await this.currentOperator(ctx);
        const stockLocationId = Number(input.stockLocationId);
        if (!stockLocationId)
            throw new core_1.UserInputError('请选择盘点仓库');
        if (!input.name || !String(input.name).trim())
            throw new core_1.UserInputError('请填写任务名称');
        const channel = await this.connection.getRepository(ctx, core_1.Channel).findOne({ where: { id: ctx.channelId } });
        const binMode = (((_a = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _a === void 0 ? void 0 : _a.binMode) || 'off');
        const scope = {
            zones: (((_b = input.scope) === null || _b === void 0 ? void 0 : _b.zones) || []).map(Number),
            categoryIds: (((_c = input.scope) === null || _c === void 0 ? void 0 : _c.categoryIds) || []).map(Number),
            variantIds: await this.resolveScopeVariants(ctx, {
                zones: [], categoryIds: ((_d = input.scope) === null || _d === void 0 ? void 0 : _d.categoryIds) || [], variantIds: ((_e = input.scope) === null || _e === void 0 ? void 0 : _e.variantIds) || [],
                includeZeroBook: false,
            }),
            includeZeroBook: !!((_f = input.scope) === null || _f === void 0 ? void 0 : _f.includeZeroBook),
        };
        // 双源：有账面（stockLevels）+ 已归位（variant_storage_bin）
        const levels = await this.connection.getRepository(ctx, core_1.StockLevel).find({
            where: { stockLocationId: stockLocationId },
        });
        const bookRows = levels.map((l) => ({ variantId: Number(l.productVariantId), quantity: l.stockOnHand }));
        const bindEntities = await this.connection.getRepository(ctx, variant_storage_bin_entity_1.VariantStorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId },
        });
        const zones = await this.connection.getRepository(ctx, storage_zone_entity_1.StorageZone).find({
            where: { tenantChannelId: tenant, stockLocationId },
        });
        const bins = await this.connection.getRepository(ctx, storage_bin_entity_1.StorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId },
        });
        const zoneById = new Map(zones.map((z) => [z.id, z]));
        const binById = new Map(bins.map((b) => [b.id, b]));
        const bindRows = bindEntities
            .filter((b) => {
            var _a;
            const z = zoneById.get(Number(b.zoneId));
            return !!z && z.enabled && (!b.binId || !!((_a = binById.get(Number(b.binId))) === null || _a === void 0 ? void 0 : _a.enabled));
        })
            .map((b) => {
            var _a, _b, _c, _d;
            return ({
                variantId: Number(b.variantId),
                zoneId: Number(b.zoneId),
                binId: b.binId ? Number(b.binId) : null,
                zoneCode: (_b = (_a = zoneById.get(Number(b.zoneId))) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : null,
                binCode: b.binId ? (_d = (_c = binById.get(Number(b.binId))) === null || _c === void 0 ? void 0 : _c.code) !== null && _d !== void 0 ? _d : null : null,
            });
        });
        const variantIds = Array.from(new Set([...bookRows.map((r) => r.variantId), ...bindRows.map((r) => r.variantId)]));
        const variants = variantIds.length
            ? await this.connection.getRepository(ctx, core_1.ProductVariant).find({ where: { id: (0, typeorm_1.In)(variantIds) } })
            : [];
        const variantMeta = new Map(variants.map((v) => [v.id, { sku: v.sku, name: v.name || v.sku }]));
        const zoneMeta = new Map(zones.map((z) => [z.id, { code: z.code, name: z.name }]));
        const expected = (0, stocktake_math_1.buildExpected)({ binMode, bookRows, bindRows, variantMeta, zoneMeta, scope });
        if (!expected.waves.some((w) => w.expectedCount > 0)) {
            throw new core_1.UserInputError('该范围下没有可盘的商品（既无账面也无归位记录），请检查圈选条件或仓库');
        }
        return this.connection.withTransaction(ctx, async (txCtx) => {
            var _a;
            const codeList = await this.connection.getRepository(txCtx, stocktake_task_entity_1.StocktakeTask).find({
                where: { tenantChannelId: tenant }, select: ['code'],
            });
            const seq = (0, stocktake_math_1.nextTaskSeq)(codeList.map((t) => t.code), new Date());
            const code = (0, stocktake_math_1.formatTaskCode)(new Date(), seq);
            const task = await this.connection.getRepository(txCtx, stocktake_task_entity_1.StocktakeTask).save(new stocktake_task_entity_1.StocktakeTask({
                code, tenantChannelId: tenant, stockLocationId,
                activityCode: input.activityCode ? String(input.activityCode).trim() : null,
                name: String(input.name).trim(),
                scopeJson: JSON.stringify(scope),
                binModeAtCreate: binMode,
                state: 'OPEN',
                createdById: operator.id, createdByName: operator.name,
                note: (_a = input.note) !== null && _a !== void 0 ? _a : null,
            }));
            for (let i = 0; i < expected.waves.length; i++) {
                const w = expected.waves[i];
                const wave = await this.connection.getRepository(txCtx, stocktake_wave_entity_1.StocktakeWave).save(new stocktake_wave_entity_1.StocktakeWave({
                    tenantChannelId: tenant, taskId: Number(task.id), scopeType: w.scopeType,
                    zoneId: w.zoneId, zoneCode: w.zoneCode, zoneName: w.zoneName,
                    state: 'OPEN', expectedCount: w.expectedCount, countedCount: 0,
                    assigneeId: null, assigneeName: null, claimedAt: null, submittedAt: null,
                }));
                const rows = expected.linesByWave[i].map((l) => new stocktake_line_entity_1.StocktakeLine({
                    tenantChannelId: tenant, taskId: Number(task.id), waveId: Number(wave.id),
                    variantId: l.variantId, variantSku: l.variantSku, variantName: l.variantName,
                    zoneId: l.zoneId, binId: l.binId, zoneCode: l.zoneCode, binCode: l.binCode,
                    bookQty: l.bookQty, countedQty: null, isExtra: false,
                }));
                if (rows.length)
                    await this.connection.getRepository(txCtx, stocktake_line_entity_1.StocktakeLine).save(rows);
            }
            return this.buildTaskView(txCtx, task);
        });
    }
    // ------------------------------------------------------------ 盘次动作
    async addWave(ctx, taskId, input) {
        await this.assertTask(ctx, taskId);
        const scopeType = String(input.scopeType || '');
        if (!['zone', 'whole', 'unassigned'].includes(scopeType)) {
            throw new core_1.UserInputError('盘次范围类型不合法（zone / whole / unassigned）');
        }
        if (scopeType === 'zone' && !input.zoneId)
            throw new core_1.UserInputError('按库区拆盘次时必须指定库区');
        // 复用建任务时的清单生成口径：把该范围内尚未落入任何盘次的行补进来
        throw new core_1.UserInputError('暂不支持手工补盘次：请在建任务时由系统按库区自动拆分（P1 再开放）');
    }
    async assignWave(ctx, waveId, assigneeId) {
        var _a;
        const wave = await this.assertWave(ctx, waveId);
        if (wave.state === 'COUNTING' && assigneeId && String(assigneeId) !== String(wave.assigneeId)) {
            throw new core_1.UserInputError('该盘次已开始录入，无法改派；请先释放再由新负责人认领');
        }
        if (!assigneeId)
            return this.releaseWave(ctx, waveId);
        const member = await this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember).findOne({
            where: { id: Number(assigneeId) },
        });
        if (!member || member.channelId !== this.tenantOf(ctx))
            throw new core_1.UserInputError('指定的负责人不存在或不属于当前店铺');
        wave.assigneeId = String(member.id);
        wave.assigneeName = member.displayName || null;
        wave.claimedAt = (_a = wave.claimedAt) !== null && _a !== void 0 ? _a : new Date();
        if (wave.state === 'OPEN')
            wave.state = 'CLAIMED';
        this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).save(wave);
        return wave;
    }
    async claimWave(ctx, waveId) {
        const wave = await this.assertWave(ctx, waveId);
        const operator = await this.currentOperator(ctx);
        if (!operator.id)
            throw new core_1.UserInputError('当前账号不是本店人员，无法认领盘次');
        if (wave.assigneeId) {
            if (String(wave.assigneeId) === String(operator.id))
                return wave; // 幂等
            throw new core_1.UserInputError(`该盘次已被 ${wave.assigneeName || '其他人员'} 认领`);
        }
        wave.assigneeId = operator.id;
        wave.assigneeName = operator.name;
        wave.claimedAt = new Date();
        if (wave.state === 'OPEN')
            wave.state = 'CLAIMED';
        return this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).save(wave);
    }
    async releaseWave(ctx, waveId) {
        const wave = await this.assertWave(ctx, waveId);
        const operator = await this.currentOperator(ctx);
        const err = (0, stocktake_math_1.waveOwnerError)(wave.assigneeId, operator.id, wave.assigneeName);
        if (err)
            throw new core_1.UserInputError(err);
        wave.assigneeId = null;
        wave.assigneeName = null;
        wave.claimedAt = null;
        wave.state = 'OPEN';
        return this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).save(wave);
    }
    async cancelWave(ctx, waveId) {
        const wave = await this.assertWave(ctx, waveId);
        if (!(0, stocktake_math_1.canWaveTransition)(wave.state, 'CANCELLED'))
            throw new core_1.UserInputError(`盘次当前状态 ${wave.state} 不可取消`);
        wave.state = 'CANCELLED';
        const saved = await this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).save(wave);
        await this.syncTaskState(ctx, wave.taskId);
        return saved;
    }
    async cancelTask(ctx, taskId) {
        const task = await this.assertTask(ctx, taskId);
        if (!(0, stocktake_math_1.canTaskTransition)(task.state, 'CANCELLED'))
            throw new core_1.UserInputError(`任务当前状态 ${task.state} 不可取消`);
        task.state = 'CANCELLED';
        const saved = await this.connection.getRepository(ctx, stocktake_task_entity_1.StocktakeTask).save(task);
        const waves = await this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).find({ where: { taskId: Number(task.id) } });
        for (const w of waves) {
            if (w.state !== 'SUBMITTED' && w.state !== 'CANCELLED') {
                w.state = 'CANCELLED';
                await this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).save(w);
            }
        }
        return this.buildTaskView(ctx, saved);
    }
    /** 盘次集合变化后同步任务状态 */
    async syncTaskState(ctx, taskId) {
        const task = await this.connection.getRepository(ctx, stocktake_task_entity_1.StocktakeTask).findOne({ where: { id: taskId } });
        if (!task)
            throw new core_1.UserInputError(`盘点任务 #${taskId} 不存在`);
        const waves = await this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).find({ where: { taskId } });
        const next = (0, stocktake_math_1.resolveTaskStateAfterWaves)(task.state, waves);
        if (next !== task.state) {
            task.state = next;
            await this.connection.getRepository(ctx, stocktake_task_entity_1.StocktakeTask).save(task);
        }
        return task.state;
    }
    // ------------------------------------------------------------ 录入
    async saveCounts(ctx, waveId, inputs) {
        const wave = await this.assertWave(ctx, waveId);
        const operator = await this.currentOperator(ctx);
        const ownerErr = (0, stocktake_math_1.waveOwnerError)(wave.assigneeId, operator.id, wave.assigneeName);
        if (ownerErr)
            throw new core_1.UserInputError(ownerErr);
        if (!Array.isArray(inputs) || !inputs.length)
            throw new core_1.UserInputError('请提交至少一行盘点数量');
        const task = await this.assertTask(ctx, wave.taskId);
        return this.connection.withTransaction(ctx, async (txCtx) => {
            var _a;
            const lines = await this.connection.getRepository(txCtx, stocktake_line_entity_1.StocktakeLine).find({ where: { waveId: Number(wave.id) } });
            const byId = new Map(lines.map((l) => [l.id, l]));
            const byVariant = new Map();
            for (const l of lines) {
                const list = byVariant.get(Number(l.variantId)) || [];
                list.push(l);
                byVariant.set(Number(l.variantId), list);
            }
            for (const item of inputs) {
                const qty = Number(item.countedQty);
                if (!Number.isFinite(qty) || qty < 0)
                    throw new core_1.UserInputError('盘点数量必须是不小于 0 的整数');
                let target;
                if (item.lineId) {
                    target = byId.get(Number(item.lineId));
                    if (!target)
                        throw new core_1.UserInputError(`应盘行 #${item.lineId} 不属于本次盘次`);
                }
                else if (item.variantId) {
                    // 扫到已在清单内的变体 → 更新原行（规格 §6.2 配套规则：不新建行）
                    const same = byVariant.get(Number(item.variantId)) || [];
                    const binId = item.binId ? Number(item.binId) : null;
                    target = same.find((l) => { var _a; return ((_a = l.binId) !== null && _a !== void 0 ? _a : null) === binId; }) || same[0];
                }
                if (!target) {
                    // 完全清单外 → 建盘盈行（isExtra=true，账面按 0）
                    const variantId = Number(item.variantId);
                    if (!variantId)
                        throw new core_1.UserInputError('清单外登记必须提供商品（variantId）');
                    const variant = await this.connection.getRepository(txCtx, core_1.ProductVariant).findOne({ where: { id: variantId } });
                    if (!variant)
                        throw new core_1.UserInputError(`商品 #${variantId} 不存在`);
                    target = new stocktake_line_entity_1.StocktakeLine({
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
                if (item.note !== undefined)
                    target.note = (_a = item.note) !== null && _a !== void 0 ? _a : null;
                if (item.zoneId)
                    target.zoneId = Number(item.zoneId);
                if (item.binId)
                    target.binId = Number(item.binId);
                await this.connection.getRepository(txCtx, stocktake_line_entity_1.StocktakeLine).save(target);
            }
            const fresh = await this.connection.getRepository(txCtx, stocktake_line_entity_1.StocktakeLine).find({ where: { waveId: Number(wave.id) } });
            wave.countedCount = fresh.filter((l) => l.countedQty !== null).length;
            wave.state = (0, stocktake_math_1.resolveWaveStateAfterCount)(wave.state, wave.countedCount);
            await this.connection.getRepository(txCtx, stocktake_wave_entity_1.StocktakeWave).save(wave);
            await this.syncTaskState(txCtx, wave.taskId);
            return wave;
        });
    }
    async submitWave(ctx, waveId) {
        const wave = await this.assertWave(ctx, waveId);
        const operator = await this.currentOperator(ctx);
        const ownerErr = (0, stocktake_math_1.waveOwnerError)(wave.assigneeId, operator.id, wave.assigneeName);
        if (ownerErr)
            throw new core_1.UserInputError(ownerErr);
        if (!(0, stocktake_math_1.canWaveTransition)(wave.state, 'SUBMITTED'))
            throw new core_1.UserInputError(`盘次当前状态 ${wave.state} 不可提交`);
        wave.state = 'SUBMITTED';
        wave.submittedAt = new Date();
        const saved = await this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).save(wave);
        await this.syncTaskState(ctx, wave.taskId);
        return saved;
    }
    // ------------------------------------------------------------ 差异与过账
    /** 读当前账面（StockLevel）+ 当前绑定（variant_storage_bin）→ 差异汇总 */
    async loadCurrentState(ctx, task, variantIds) {
        if (!variantIds.length)
            return { currentBook: [], currentBind: [] };
        const levels = await this.connection.getRepository(ctx, core_1.StockLevel).find({
            where: { stockLocationId: task.stockLocationId, productVariantId: (0, typeorm_1.In)(variantIds) },
        });
        const currentBook = levels.map((l) => ({ variantId: Number(l.productVariantId), quantity: l.stockOnHand }));
        const binds = await this.connection.getRepository(ctx, variant_storage_bin_entity_1.VariantStorageBin).find({
            where: { tenantChannelId: task.tenantChannelId, stockLocationId: task.stockLocationId, variantId: (0, typeorm_1.In)(variantIds) },
        });
        const currentBind = binds.map((b) => ({
            variantId: Number(b.variantId), zoneId: Number(b.zoneId), binId: b.binId ? Number(b.binId) : null,
        }));
        return { currentBook, currentBind };
    }
    async diffOf(ctx, taskId) {
        const task = await this.assertTask(ctx, taskId, { allowPosted: true });
        const lines = await this.connection.getRepository(ctx, stocktake_line_entity_1.StocktakeLine).find({ where: { taskId: Number(task.id) } });
        const variantIds = Array.from(new Set(lines.map((l) => Number(l.variantId))));
        const { currentBook, currentBind } = await this.loadCurrentState(ctx, task, variantIds);
        const input = lines.map((l) => ({
            id: l.id, variantId: Number(l.variantId), countedQty: l.countedQty,
            isExtra: l.isExtra, bookQty: l.bookQty,
            zoneId: l.zoneId, binId: l.binId,
        }));
        const summary = (0, stocktake_math_1.summarizeVariance)(input, currentBook, currentBind);
        const skuOf = new Map(lines.map((l) => [Number(l.variantId), { sku: l.variantSku, name: l.variantName }]));
        return {
            summary,
            rows: summary.byVariant.map((v) => {
                var _a, _b, _c, _d;
                return ({
                    variantId: String(v.variantId),
                    variantSku: (_b = (_a = skuOf.get(v.variantId)) === null || _a === void 0 ? void 0 : _a.sku) !== null && _b !== void 0 ? _b : `#${v.variantId}`,
                    variantName: (_d = (_c = skuOf.get(v.variantId)) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '',
                    countedTotal: v.countedTotal, bookQty: v.bookQty, diff: v.diff,
                    isExtra: v.isExtra, binChanged: v.binChanged,
                    targetZoneId: v.targetZoneId === null ? null : String(v.targetZoneId),
                    targetBinId: v.targetBinId === null ? null : String(v.targetBinId),
                    targetBinCode: null,
                    snapBookQty: v.snapBookQty, currentBookQty: v.bookQty,
                });
            }),
            uncountedLines: lines.filter((l) => !l.isExtra && l.countedQty === null),
            changedVariants: summary.changedVariants.map((c) => {
                var _a, _b;
                return ({
                    variantId: String(c.variantId),
                    variantSku: (_b = (_a = skuOf.get(c.variantId)) === null || _a === void 0 ? void 0 : _a.sku) !== null && _b !== void 0 ? _b : `#${c.variantId}`,
                    snapBookQty: c.snapBookQty, currentBookQty: c.currentBookQty,
                });
            }),
        };
    }
    async post(ctx, taskId, confirm) {
        const task = await this.assertTask(ctx, taskId, { allowPosted: true });
        if (task.state === 'POSTED')
            throw new core_1.UserInputError(`任务 ${task.code} 已过账，请勿重复操作`);
        if (task.state !== 'COUNTED')
            throw new core_1.UserInputError(`任务当前状态 ${task.state}，需全部盘次提交后才能过账`);
        const waves = await this.connection.getRepository(ctx, stocktake_wave_entity_1.StocktakeWave).find({ where: { taskId: Number(task.id) } });
        const pending = waves.filter((w) => w.state !== 'SUBMITTED' && w.state !== 'CANCELLED');
        if (pending.length) {
            throw new core_1.UserInputError(`还有 ${pending.length} 个盘次未提交（${pending.map((w) => w.id).join(', ')}），无法过账`);
        }
        const diff = await this.diffOf(ctx, task.id);
        if (diff.summary.uncountedCount > 0 && !confirm) {
            return {
                ok: false, stockDocId: null, diff,
                message: `有 ${diff.summary.uncountedCount} 项未盘，若确认跳过请勾选后重试`,
            };
        }
        if (diff.summary.recheck && !confirm) {
            return {
                ok: false, stockDocId: null, diff,
                message: `盘点期间账面发生变动（${diff.summary.changedVariants.length} 个商品），已按当前账面重算，请确认后继续`,
            };
        }
        const plan = (0, stocktake_math_1.buildPostItems)({ summary: diff.summary, stockLocationId: task.stockLocationId });
        if (!plan.items.length)
            throw new core_1.UserInputError('没有需要过账的差异（数量与库位均无变化）');
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const items = plan.items.map((i) => ({
                variantId: String(i.variantId),
                toStockLocationId: String(i.toStockLocationId),
                qty: i.realQty,
                realQty: i.realQty,
                zoneId: i.zoneId === null ? undefined : String(i.zoneId),
                binId: i.binId === null ? undefined : String(i.binId),
            }));
            const doc = await this.stockDocService.create(txCtx, {
                type: 'STOCKTAKE',
                items,
                remark: `盘点任务 ${task.code}`,
            });
            task.state = 'POSTED';
            task.postedStockDocId = Number(doc.id);
            task.postedAt = new Date();
            await this.connection.getRepository(txCtx, stocktake_task_entity_1.StocktakeTask).save(task);
            return { ok: true, stockDocId: String(doc.id), diff, message: `已生成盘点单据 ${task.code}` };
        });
    }
};
exports.StocktakeService = StocktakeService;
exports.StocktakeService = StocktakeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        stock_doc_service_1.StockDocService])
], StocktakeService);
//# sourceMappingURL=stocktake.service.js.map