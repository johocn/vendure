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
exports.StorageBinService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const storage_bin_entity_1 = require("./storage-bin.entity");
const storage_zone_entity_1 = require("./storage-zone.entity");
const variant_storage_bin_entity_1 = require("./variant-storage-bin.entity");
const standard_warehouse_template_1 = require("./standard-warehouse-template");
const bin_query_math_1 = require("./bin-query.math");
let StorageBinService = class StorageBinService {
    constructor(connection) {
        this.connection = connection;
    }
    tenantOf(ctx) {
        return String(ctx.channelId);
    }
    /** 读渠道开关，缺省按 off（对现网零影响） */
    static resolveMode(customFields) {
        const v = customFields === null || customFields === void 0 ? void 0 : customFields.binMode;
        return v === 'zone' || v === 'bin' ? v : 'off';
    }
    async zones(ctx, stockLocationId) {
        return this.connection.getRepository(ctx, storage_zone_entity_1.StorageZone).find({
            where: { tenantChannelId: this.tenantOf(ctx), stockLocationId },
            order: { sortOrder: 'ASC', code: 'ASC' },
        });
    }
    async bins(ctx, stockLocationId, zoneId) {
        const repo = this.connection.getRepository(ctx, storage_bin_entity_1.StorageBin);
        const where = { tenantChannelId: this.tenantOf(ctx), stockLocationId };
        if (zoneId)
            where.zoneId = zoneId;
        return repo.find({ where, order: { rowNo: 'ASC', levelNo: 'ASC' } });
    }
    /** 每个库位被多少 SKU 占用（库位管理页展示用） */
    async binBindCounts(ctx, stockLocationId) {
        const rows = await this.connection
            .getRepository(ctx, variant_storage_bin_entity_1.VariantStorageBin)
            .createQueryBuilder('b')
            .select('b.binId', 'binId')
            .addSelect('COUNT(1)', 'n')
            .where('b.tenantChannelId = :t', { t: this.tenantOf(ctx) })
            .andWhere('b.stockLocationId = :w', { w: stockLocationId })
            .andWhere('b.binId IS NOT NULL')
            .groupBy('b.binId')
            .getRawMany();
        const map = new Map();
        for (const r of rows)
            map.set(Number(r.binId), Number(r.n));
        return map;
    }
    /**
     * 生成标准库位（幂等）：已存在的库区/库位编码跳过，可重复点击补齐。
     * 返回本次新建数量，供前端提示。
     */
    async generateStandard(ctx, stockLocationId) {
        const t = this.tenantOf(ctx);
        const zoneRepo = this.connection.getRepository(ctx, storage_zone_entity_1.StorageZone);
        const binRepo = this.connection.getRepository(ctx, storage_bin_entity_1.StorageBin);
        const existingZones = await zoneRepo.find({ where: { tenantChannelId: t, stockLocationId } });
        const zoneByCode = new Map(existingZones.map((z) => [z.code, z]));
        let zonesCreated = 0;
        let binsCreated = 0;
        for (let i = 0; i < standard_warehouse_template_1.STANDARD_WAREHOUSE_ZONES.length; i++) {
            const spec = standard_warehouse_template_1.STANDARD_WAREHOUSE_ZONES[i];
            let zone = zoneByCode.get(spec.code);
            if (!zone) {
                zone = await zoneRepo.save(zoneRepo.create({
                    tenantChannelId: t,
                    stockLocationId,
                    code: spec.code,
                    name: spec.name,
                    sortOrder: i + 1,
                    enabled: true,
                }));
                zoneByCode.set(spec.code, zone);
                zonesCreated++;
            }
            const existingBins = await binRepo.find({
                where: { tenantChannelId: t, stockLocationId, zoneId: zone.id },
            });
            const codes = new Set(existingBins.map((b) => b.code));
            const toCreate = (0, standard_warehouse_template_1.expandZone)(spec)
                .filter((b) => !codes.has(b.code))
                .map((b) => binRepo.create({
                tenantChannelId: t,
                stockLocationId,
                zoneId: zone.id,
                code: b.code,
                rowNo: b.rowNo,
                levelNo: b.levelNo,
                enabled: true,
            }));
            if (toCreate.length > 0) {
                await binRepo.save(toCreate);
                binsCreated += toCreate.length;
            }
        }
        return { zonesCreated, binsCreated };
    }
    /** 由库位反查库区（入库只传 binId 时用） */
    async binZoneId(ctx, binId) {
        var _a;
        const bin = await this.connection
            .getRepository(ctx, storage_bin_entity_1.StorageBin)
            .findOne({ where: { id: binId } });
        return (_a = bin === null || bin === void 0 ? void 0 : bin.zoneId) !== null && _a !== void 0 ? _a : null;
    }
    async variantBin(ctx, variantId, stockLocationId) {
        const row = await this.connection.getRepository(ctx, variant_storage_bin_entity_1.VariantStorageBin).findOne({
            where: { tenantChannelId: this.tenantOf(ctx), variantId, stockLocationId },
        });
        if (!row)
            return null;
        const zone = await this.connection
            .getRepository(ctx, storage_zone_entity_1.StorageZone)
            .findOne({ where: { id: row.zoneId } });
        const bin = row.binId
            ? await this.connection.getRepository(ctx, storage_bin_entity_1.StorageBin).findOne({ where: { id: row.binId } })
            : null;
        return Object.assign(Object.assign({}, row), { zone, bin });
    }
    /**
     * 归位（幂等 upsert）。
     * - bin 档：传 binId，服务端自行推导 zoneId
     * - zone 档：传 zoneId，binId 置 null
     * 入库时若 SKU 已有绑定且未显式传参，保持原绑定不动。
     */
    async bind(ctx, input) {
        var _a, _b;
        const t = this.tenantOf(ctx);
        const repo = this.connection.getRepository(ctx, variant_storage_bin_entity_1.VariantStorageBin);
        // 校验库位属于该仓且属于该库区
        if (input.binId) {
            const bin = await this.connection
                .getRepository(ctx, storage_bin_entity_1.StorageBin)
                .findOne({ where: { id: input.binId } });
            if (!bin)
                throw new core_1.UserInputError(`库位 ${input.binId} 不存在`);
            if (bin.stockLocationId !== input.stockLocationId) {
                throw new core_1.UserInputError('库位不属于所选仓库，请重新选择');
            }
            if (bin.zoneId !== input.zoneId) {
                throw new core_1.UserInputError('库位与库区不匹配，请重新选择');
            }
        }
        const existing = await repo.findOne({
            where: { tenantChannelId: t, variantId: input.variantId, stockLocationId: input.stockLocationId },
        });
        if (existing) {
            existing.zoneId = input.zoneId;
            existing.binId = (_a = input.binId) !== null && _a !== void 0 ? _a : null;
            return repo.save(existing);
        }
        return repo.save(repo.create({
            tenantChannelId: t,
            variantId: input.variantId,
            stockLocationId: input.stockLocationId,
            zoneId: input.zoneId,
            binId: (_b = input.binId) !== null && _b !== void 0 ? _b : null,
            isDefault: true,
        }));
    }
    async unbind(ctx, variantId, stockLocationId) {
        await this.connection
            .getRepository(ctx, variant_storage_bin_entity_1.VariantStorageBin)
            .createQueryBuilder()
            .delete()
            .where('tenantChannelId = :t AND variantId = :v AND stockLocationId = :w', {
            t: this.tenantOf(ctx),
            v: variantId,
            w: stockLocationId,
        })
            .execute();
        return true;
    }
    /** 删除库位前校验：有 SKU 绑定则拒绝 */
    async deleteBin(ctx, binId) {
        const bound = await this.connection
            .getRepository(ctx, variant_storage_bin_entity_1.VariantStorageBin)
            .count({ where: { binId: binId } });
        if (bound > 0) {
            throw new core_1.UserInputError(`该库位已被 ${bound} 个 SKU 占用，请先解绑`);
        }
        await this.connection.getRepository(ctx, storage_bin_entity_1.StorageBin).delete({ id: binId });
        return true;
    }
    /** 本仓全部绑定行 → 明细行（含商品字段），供 variantBinsByLocation 过滤/排序/分页 */
    async loadVariantBinRows(ctx, stockLocationId, includeDisabled = false) {
        var _a, _b, _c, _d, _e, _f, _g;
        const tenant = this.tenantOf(ctx);
        const bindings = await this.connection.getRepository(ctx, variant_storage_bin_entity_1.VariantStorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId: Number(stockLocationId) },
        });
        const zones = await this.connection.getRepository(ctx, storage_zone_entity_1.StorageZone).find({
            where: { tenantChannelId: tenant, stockLocationId: Number(stockLocationId) },
        });
        const bins = await this.connection.getRepository(ctx, storage_bin_entity_1.StorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId: Number(stockLocationId) },
        });
        const zoneById = new Map(zones.map((z) => [z.id, z]));
        const binById = new Map(bins.map((b) => [b.id, b]));
        const variantIds = Array.from(new Set(bindings.map((b) => Number(b.variantId))));
        // ProductVariant 是 ChannelAware：必须显式 innerJoin channels 按渠道收口，
        // 否则裸仓储查询不过滤渠道（配货台已有前车之鉴）。R10。
        const variants = variantIds.length
            ? await this.connection
                .getRepository(ctx, core_1.ProductVariant)
                .createQueryBuilder('v')
                .innerJoin('v.channels', 'c', 'c.id = :cid', { cid: ctx.channelId })
                .where('v.id IN (:...ids)', { ids: variantIds })
                .getMany()
            : [];
        const variantById = new Map(variants.map((v) => [v.id, v]));
        const rows = [];
        for (const binding of bindings) {
            const zone = zoneById.get(Number(binding.zoneId));
            const bin = binding.binId ? binById.get(Number(binding.binId)) : undefined;
            const variant = variantById.get(Number(binding.variantId));
            if (!variant)
                continue; // 变体被删 → 该行不出现
            if (!zone && !bin)
                continue; // 库区与库位都缺失 → 孤儿绑定，不出现
            if (!includeDisabled && ((zone && !zone.enabled) || (bin && !bin.enabled)))
                continue;
            const barcode = (_b = (_a = variant.customFields) === null || _a === void 0 ? void 0 : _a.barcode) !== null && _b !== void 0 ? _b : null;
            const internalCode = (_d = (_c = variant.customFields) === null || _c === void 0 ? void 0 : _c.internalCode) !== null && _d !== void 0 ? _d : null;
            rows.push({
                bindingId: binding.id,
                variantId: Number(binding.variantId),
                sku: variant.sku,
                variantName: variant.name || variant.sku,
                barcode, internalCode,
                zoneId: Number(binding.zoneId),
                zoneCode: (_e = zone === null || zone === void 0 ? void 0 : zone.code) !== null && _e !== void 0 ? _e : '',
                zoneName: (_f = zone === null || zone === void 0 ? void 0 : zone.name) !== null && _f !== void 0 ? _f : '',
                zoneSortOrder: (_g = zone === null || zone === void 0 ? void 0 : zone.sortOrder) !== null && _g !== void 0 ? _g : 0,
                binId: bin ? bin.id : null,
                binCode: bin ? bin.code : null,
                rowNo: bin ? bin.rowNo : null,
                levelNo: bin ? bin.levelNo : null,
                isDefault: !!binding.isDefault,
            });
        }
        return rows;
    }
    /** 库位/库区 → SKU 明细分页（规格 §7.1 接口 1） */
    async variantBinsByLocation(ctx, args) {
        var _a, _b;
        const binId = args.binId ? Number(args.binId) : null;
        if (binId !== null) {
            const bin = await this.connection.getRepository(ctx, storage_bin_entity_1.StorageBin).findOne({
                where: { tenantChannelId: this.tenantOf(ctx), id: binId },
            });
            const err = (0, bin_query_math_1.assertZoneBinMatch)(args.zoneId ? Number(args.zoneId) : null, binId, bin ? Number(bin.zoneId) : null);
            if (err)
                throw new core_1.UserInputError(err);
        }
        const rows = await this.loadVariantBinRows(ctx, args.stockLocationId, !!args.includeDisabled);
        const filtered = (0, bin_query_math_1.sortVariantBins)((0, bin_query_math_1.filterVariantBins)(rows, {
            zoneId: args.zoneId ? Number(args.zoneId) : null,
            binId, keyword: args.keyword, includeDisabled: args.includeDisabled,
        }));
        return (0, bin_query_math_1.paginate)(filtered, (_a = args.page) !== null && _a !== void 0 ? _a : 1, (_b = args.pageSize) !== null && _b !== void 0 ? _b : bin_query_math_1.BIN_PAGE_DEFAULT);
    }
    /** 全部启用库位的占用概览（含空格，喂格子宫格；规格 §7.1 接口 2） */
    async binOccupancy(ctx, stockLocationId, zoneId) {
        const tenant = this.tenantOf(ctx);
        const zoneWhere = { tenantChannelId: tenant, stockLocationId: Number(stockLocationId) };
        if (zoneId)
            zoneWhere.id = Number(zoneId);
        const zones = await this.connection.getRepository(ctx, storage_zone_entity_1.StorageZone).find({ where: Object.assign(Object.assign({}, zoneWhere), { enabled: true }) });
        const zoneIds = zones.map((z) => z.id);
        if (!zoneIds.length)
            return [];
        const bins = await this.connection.getRepository(ctx, storage_bin_entity_1.StorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId: Number(stockLocationId), zoneId: (0, typeorm_1.In)(zoneIds) },
        });
        const zoneById = new Map(zones.map((z) => [z.id, z]));
        const inputs = bins
            .filter((b) => b.enabled)
            .map((b) => {
            var _a, _b, _c;
            const z = zoneById.get(Number(b.zoneId));
            return {
                zoneId: Number(b.zoneId),
                zoneCode: (_a = z === null || z === void 0 ? void 0 : z.code) !== null && _a !== void 0 ? _a : '',
                zoneName: (_b = z === null || z === void 0 ? void 0 : z.name) !== null && _b !== void 0 ? _b : '',
                zoneSortOrder: (_c = z === null || z === void 0 ? void 0 : z.sortOrder) !== null && _c !== void 0 ? _c : 0,
                binId: b.id,
                binCode: b.code,
                rowNo: b.rowNo,
                levelNo: b.levelNo,
            };
        });
        const counts = await this.binBindCounts(ctx, Number(stockLocationId));
        return (0, bin_query_math_1.buildOccupancyRows)(inputs, counts);
    }
};
exports.StorageBinService = StorageBinService;
exports.StorageBinService = StorageBinService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], StorageBinService);
//# sourceMappingURL=storage-bin.service.js.map