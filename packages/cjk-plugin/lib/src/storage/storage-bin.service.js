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
const storage_bin_entity_1 = require("./storage-bin.entity");
const storage_zone_entity_1 = require("./storage-zone.entity");
const variant_storage_bin_entity_1 = require("./variant-storage-bin.entity");
const standard_warehouse_template_1 = require("./standard-warehouse-template");
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
};
exports.StorageBinService = StorageBinService;
exports.StorageBinService = StorageBinService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], StorageBinService);
//# sourceMappingURL=storage-bin.service.js.map