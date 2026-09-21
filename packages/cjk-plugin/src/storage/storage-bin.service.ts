import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { StorageBin } from './storage-bin.entity';
import { StorageZone } from './storage-zone.entity';
import { VariantStorageBin } from './variant-storage-bin.entity';
import { STANDARD_WAREHOUSE_ZONES, expandZone } from './standard-warehouse-template';

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
}