import { Injectable } from '@nestjs/common';
import { ID, ProductVariant, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { In } from 'typeorm';

import { StorageBin } from './storage-bin.entity';
import { StorageZone } from './storage-zone.entity';
import { VariantStorageBin } from './variant-storage-bin.entity';
import { STANDARD_WAREHOUSE_ZONES, expandZone } from './standard-warehouse-template';
import {
    BIN_PAGE_DEFAULT, BinOccupancyRow, BinRowInput, VariantBinRow,
    assertZoneBinMatch, buildOccupancyRows, filterVariantBins, paginate, sortVariantBins,
} from './bin-query.math';

export type BinMode = 'off' | 'zone' | 'bin';

@Injectable()
export class StorageBinService {
    constructor(private connection: TransactionalConnection) {}

    private tenantOf(ctx: RequestContext): string {
        return String(ctx.channelId);
    }

    /** 读渠道开关，缺省按 off（对现网零影响） */
    static resolveMode(customFields: any): BinMode {
        const v = customFields?.binMode;
        return v === 'zone' || v === 'bin' ? v : 'off';
    }

    async zones(ctx: RequestContext, stockLocationId: number) {
        return this.connection.getRepository(ctx, StorageZone).find({
            where: { tenantChannelId: this.tenantOf(ctx), stockLocationId },
            order: { sortOrder: 'ASC', code: 'ASC' },
        });
    }

    async bins(ctx: RequestContext, stockLocationId: number, zoneId?: number | null) {
        const repo = this.connection.getRepository(ctx, StorageBin);
        const where: any = { tenantChannelId: this.tenantOf(ctx), stockLocationId };
        if (zoneId) where.zoneId = zoneId;
        return repo.find({ where, order: { rowNo: 'ASC', levelNo: 'ASC' } });
    }

    /** 每个库位被多少 SKU 占用（库位管理页展示用） */
    async binBindCounts(ctx: RequestContext, stockLocationId: number): Promise<Map<number, number>> {
        const rows = await this.connection
            .getRepository(ctx, VariantStorageBin)
            .createQueryBuilder('b')
            .select('b.binId', 'binId')
            .addSelect('COUNT(1)', 'n')
            .where('b.tenantChannelId = :t', { t: this.tenantOf(ctx) })
            .andWhere('b.stockLocationId = :w', { w: stockLocationId })
            .andWhere('b.binId IS NOT NULL')
            .groupBy('b.binId')
            .getRawMany<{ binId: number; n: string }>();
        const map = new Map<number, number>();
        for (const r of rows) map.set(Number(r.binId), Number(r.n));
        return map;
    }

    /**
     * 生成标准库位（幂等）：已存在的库区/库位编码跳过，可重复点击补齐。
     * 返回本次新建数量，供前端提示。
     */
    async generateStandard(
        ctx: RequestContext,
        stockLocationId: number,
    ): Promise<{ zonesCreated: number; binsCreated: number }> {
        const t = this.tenantOf(ctx);
        const zoneRepo = this.connection.getRepository(ctx, StorageZone);
        const binRepo = this.connection.getRepository(ctx, StorageBin);

        const existingZones = await zoneRepo.find({ where: { tenantChannelId: t, stockLocationId } });
        const zoneByCode = new Map(existingZones.map((z) => [z.code, z]));

        let zonesCreated = 0;
        let binsCreated = 0;

        for (let i = 0; i < STANDARD_WAREHOUSE_ZONES.length; i++) {
            const spec = STANDARD_WAREHOUSE_ZONES[i];
            let zone = zoneByCode.get(spec.code);
            if (!zone) {
                zone = await zoneRepo.save(
                    zoneRepo.create({
                        tenantChannelId: t,
                        stockLocationId,
                        code: spec.code,
                        name: spec.name,
                        sortOrder: i + 1,
                        enabled: true,
                    }),
                );
                zoneByCode.set(spec.code, zone);
                zonesCreated++;
            }

            const existingBins = await binRepo.find({
                where: { tenantChannelId: t, stockLocationId, zoneId: zone.id as number },
            });
            const codes = new Set(existingBins.map((b) => b.code));

            const toCreate = expandZone(spec)
                .filter((b) => !codes.has(b.code))
                .map((b) =>
                    binRepo.create({
                        tenantChannelId: t,
                        stockLocationId,
                        zoneId: zone!.id as number,
                        code: b.code,
                        rowNo: b.rowNo,
                        levelNo: b.levelNo,
                        enabled: true,
                    }),
                );
            if (toCreate.length > 0) {
                await binRepo.save(toCreate);
                binsCreated += toCreate.length;
            }
        }
        return { zonesCreated, binsCreated };
    }

    /** 由库位反查库区（入库只传 binId 时用） */
    async binZoneId(ctx: RequestContext, binId: number): Promise<number | null> {
        const bin = await this.connection
            .getRepository(ctx, StorageBin)
            .findOne({ where: { id: binId } });
        return bin?.zoneId ?? null;
    }

    async variantBin(ctx: RequestContext, variantId: number, stockLocationId: number) {
        const row = await this.connection.getRepository(ctx, VariantStorageBin).findOne({
            where: { tenantChannelId: this.tenantOf(ctx), variantId, stockLocationId },
        });
        if (!row) return null;
        const zone = await this.connection
            .getRepository(ctx, StorageZone)
            .findOne({ where: { id: row.zoneId } });
        const bin = row.binId
            ? await this.connection.getRepository(ctx, StorageBin).findOne({ where: { id: row.binId } })
            : null;
        return { ...row, zone, bin };
    }

    /**
     * 归位（幂等 upsert）。
     * - bin 档：传 binId，服务端自行推导 zoneId
     * - zone 档：传 zoneId，binId 置 null
     * 入库时若 SKU 已有绑定且未显式传参，保持原绑定不动。
     */
    async bind(
        ctx: RequestContext,
        input: { variantId: number; stockLocationId: number; zoneId: number; binId?: number | null },
    ) {
        const t = this.tenantOf(ctx);
        const repo = this.connection.getRepository(ctx, VariantStorageBin);

        // 校验库位属于该仓且属于该库区
        if (input.binId) {
            const bin = await this.connection
                .getRepository(ctx, StorageBin)
                .findOne({ where: { id: input.binId } });
            if (!bin) throw new UserInputError(`库位 ${input.binId} 不存在`);
            if (bin.stockLocationId !== input.stockLocationId) {
                throw new UserInputError('库位不属于所选仓库，请重新选择');
            }
            if (bin.zoneId !== input.zoneId) {
                throw new UserInputError('库位与库区不匹配，请重新选择');
            }
        }

        const existing = await repo.findOne({
            where: { tenantChannelId: t, variantId: input.variantId, stockLocationId: input.stockLocationId },
        });

        if (existing) {
            existing.zoneId = input.zoneId;
            existing.binId = input.binId ?? null;
            return repo.save(existing);
        }

        return repo.save(
            repo.create({
                tenantChannelId: t,
                variantId: input.variantId,
                stockLocationId: input.stockLocationId,
                zoneId: input.zoneId,
                binId: input.binId ?? null,
                isDefault: true,
            }),
        );
    }

    async unbind(ctx: RequestContext, variantId: number, stockLocationId: number) {
        await this.connection
            .getRepository(ctx, VariantStorageBin)
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
    async deleteBin(ctx: RequestContext, binId: ID) {
        const bound = await this.connection
            .getRepository(ctx, VariantStorageBin)
            .count({ where: { binId: binId as number } });
        if (bound > 0) {
            throw new UserInputError(`该库位已被 ${bound} 个 SKU 占用，请先解绑`);
        }
        await this.connection.getRepository(ctx, StorageBin).delete({ id: binId as number });
        return true;
    }

    /** 本仓全部绑定行 → 明细行（含商品字段），供 variantBinsByLocation 过滤/排序/分页 */
    private async loadVariantBinRows(ctx: RequestContext, stockLocationId: ID, includeDisabled = false) {
        const tenant = this.tenantOf(ctx);
        const bindings = await this.connection.getRepository(ctx, VariantStorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId: Number(stockLocationId) },
        });
        const zones = await this.connection.getRepository(ctx, StorageZone).find({
            where: { tenantChannelId: tenant, stockLocationId: Number(stockLocationId) },
        });
        const bins = await this.connection.getRepository(ctx, StorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId: Number(stockLocationId) },
        });
        const zoneById = new Map(zones.map((z) => [z.id as number, z]));
        const binById = new Map(bins.map((b) => [b.id as number, b]));
        const variantIds = Array.from(new Set(bindings.map((b) => Number(b.variantId))));
        // ProductVariant 是 ChannelAware：必须显式 innerJoin channels 按渠道收口，
        // 否则裸仓储查询不过滤渠道（配货台已有前车之鉴）。R10。
        const variants = variantIds.length
            ? await this.connection
                .getRepository(ctx, ProductVariant)
                .createQueryBuilder('v')
                .innerJoin('v.channels', 'c', 'c.id = :cid', { cid: ctx.channelId })
                .where('v.id IN (:...ids)', { ids: variantIds })
                .getMany()
            : [];
        const variantById = new Map(variants.map((v) => [v.id as number, v]));

        const rows: VariantBinRow[] = [];
        for (const binding of bindings) {
            const zone = zoneById.get(Number(binding.zoneId));
            const bin = binding.binId ? binById.get(Number(binding.binId)) : undefined;
            const variant = variantById.get(Number(binding.variantId));
            if (!variant) continue;                              // 变体被删 → 该行不出现
            if (!zone && !bin) continue;                         // 库区与库位都缺失 → 孤儿绑定，不出现
            if (!includeDisabled && ((zone && !zone.enabled) || (bin && !bin.enabled))) continue;
            const barcode = (variant.customFields as any)?.barcode ?? null;
            const internalCode = (variant.customFields as any)?.internalCode ?? null;
            rows.push({
                bindingId: binding.id as number,
                variantId: Number(binding.variantId),
                sku: variant.sku,
                variantName: variant.name || variant.sku,
                barcode, internalCode,
                zoneId: Number(binding.zoneId),
                zoneCode: zone?.code ?? '',
                zoneName: zone?.name ?? '',
                zoneSortOrder: zone?.sortOrder ?? 0,
                binId: bin ? (bin.id as number) : null,
                binCode: bin ? bin.code : null,
                rowNo: bin ? bin.rowNo : null,
                levelNo: bin ? bin.levelNo : null,
                isDefault: !!binding.isDefault,
            });
        }
        return rows;
    }

    /** 库位/库区 → SKU 明细分页（规格 §7.1 接口 1） */
    async variantBinsByLocation(
        ctx: RequestContext,
        args: { stockLocationId: ID; zoneId?: ID; binId?: ID; keyword?: string; includeDisabled?: boolean; page?: number; pageSize?: number },
    ): Promise<{ totalItems: number; items: VariantBinRow[] }> {
        const binId = args.binId ? Number(args.binId) : null;
        if (binId !== null) {
            const bin = await this.connection.getRepository(ctx, StorageBin).findOne({
                where: { tenantChannelId: this.tenantOf(ctx), id: binId },
            });
            const err = assertZoneBinMatch(args.zoneId ? Number(args.zoneId) : null, binId, bin ? Number(bin.zoneId) : null);
            if (err) throw new UserInputError(err);
        }
        const rows = await this.loadVariantBinRows(ctx, args.stockLocationId, !!args.includeDisabled);
        const filtered = sortVariantBins(filterVariantBins(rows, {
            zoneId: args.zoneId ? Number(args.zoneId) : null,
            binId, keyword: args.keyword, includeDisabled: args.includeDisabled,
        }));
        return paginate(filtered, args.page ?? 1, args.pageSize ?? BIN_PAGE_DEFAULT);
    }

    /** 全部启用库位的占用概览（含空格，喂格子宫格；规格 §7.1 接口 2） */
    async binOccupancy(ctx: RequestContext, stockLocationId: ID, zoneId?: ID): Promise<BinOccupancyRow[]> {
        const tenant = this.tenantOf(ctx);
        const zoneWhere: any = { tenantChannelId: tenant, stockLocationId: Number(stockLocationId) };
        if (zoneId) zoneWhere.id = Number(zoneId);
        const zones = await this.connection.getRepository(ctx, StorageZone).find({ where: { ...zoneWhere, enabled: true } });
        const zoneIds = zones.map((z) => z.id as number);
        if (!zoneIds.length) return [];
        const bins = await this.connection.getRepository(ctx, StorageBin).find({
            where: { tenantChannelId: tenant, stockLocationId: Number(stockLocationId), zoneId: In(zoneIds) } as any,
        });
        const zoneById = new Map(zones.map((z) => [z.id as number, z]));
        const inputs: BinRowInput[] = bins
            .filter((b) => b.enabled)
            .map((b) => {
                const z = zoneById.get(Number(b.zoneId));
                return {
                    zoneId: Number(b.zoneId),
                    zoneCode: z?.code ?? '',
                    zoneName: z?.name ?? '',
                    zoneSortOrder: z?.sortOrder ?? 0,
                    binId: b.id as number,
                    binCode: b.code,
                    rowNo: b.rowNo,
                    levelNo: b.levelNo,
                };
            });
        const counts = await this.binBindCounts(ctx, Number(stockLocationId));
        return buildOccupancyRows(inputs, counts);
    }
}