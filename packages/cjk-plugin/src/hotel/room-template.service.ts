import { Injectable } from '@nestjs/common';
import { ID, ProductVariant, RequestContext, TransactionalConnection } from '@vendure/core';
import { RoomTemplate } from './room-template.entity';
import { RoomTemplateControl } from './room-template-control.entity';
import { resolveSeedActions } from './room-template-seed-logic';
import { buildSeedTemplate } from './room-template-seeds';
import { HotelConfig, validateHotelConfig } from './hotel-config';

@Injectable()
export class RoomTemplateService {
    constructor(private connection: TransactionalConnection) {}

    findAll(): Promise<RoomTemplate[]> {
        return this.connection
            .getRepository(RoomTemplate)
            .find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } });
    }

    async findOne(id: ID): Promise<RoomTemplate | undefined> {
        const result = await this.connection.getRepository(RoomTemplate).findOne({ where: { id } as any });
        return result ?? undefined;
    }

    async create(input: any): Promise<RoomTemplate> {
        const check = validateHotelConfig({
            basePriceCent: input.basePriceCent,
            priceCalendar: input.priceCalendar ?? undefined,
            specs: input.specs ?? undefined,
        });
        if (!check.valid) {
            throw new Error(`RoomTemplate 校验失败: ${check.errors.join('; ')}`);
        }
        const repo = this.connection.getRepository(RoomTemplate);
        const entity = new RoomTemplate({
            ...input,
            name: typeof input.name === 'string' ? input.name : JSON.stringify(input.name ?? ''),
        });
        return repo.save(entity);
    }

    async update(id: ID, input: any): Promise<RoomTemplate> {
        const check = validateHotelConfig({
            basePriceCent: input.basePriceCent,
            priceCalendar: input.priceCalendar ?? undefined,
            specs: input.specs ?? undefined,
        });
        if (!check.valid) {
            throw new Error(`RoomTemplate 校验失败: ${check.errors.join('; ')}`);
        }
        const repo = this.connection.getRepository(RoomTemplate);
        const entity = await repo.findOneOrFail({ where: { id } as any });
        Object.assign(entity, input);
        if (input.name && typeof input.name !== 'string') {
            entity.name = JSON.stringify(input.name);
        }
        return repo.save(entity);
    }

    async delete(id: ID): Promise<void> {
        const repo = this.connection.getRepository(RoomTemplate);
        const entity = await repo.findOneOrFail({ where: { id } as any });
        // 删除前先在 control 表记录 deleted，保证 seed 幂等：删除过的 code 重启不再补回
        const controlRepo = this.connection.getRepository(RoomTemplateControl);
        const existing = await controlRepo.findOne({ where: { code: entity.code } as any });
        if (existing) { existing.deleted = true; await controlRepo.save(existing); }
        else { await controlRepo.save(new RoomTemplateControl({ code: entity.code, deleted: true })); }
        await repo.remove(entity);
    }

    /** 幂等补种默认房型：已存在或已删除的 code 跳过；插入前通过 validateHotelConfig 校验，单条异常跳过不阻断整体。 */
    async seedDefaultTemplates(): Promise<number> {
        const rtRepo = this.connection.getRepository(RoomTemplate);
        const controlRepo = this.connection.getRepository(RoomTemplateControl);
        const existing = new Set((await rtRepo.find({ select: ['code'] as any })).map((r) => r.code));
        const deleted = new Set((await controlRepo.find({ select: ['code'] as any })).map((c) => c.code));
        const toInsert = resolveSeedActions(existing, deleted);
        let inserted = 0;
        for (const seed of toInsert) {
            const input = buildSeedTemplate(seed);
            const check = validateHotelConfig({
                basePriceCent: input.basePriceCent,
                priceCalendar: input.priceCalendar ?? undefined,
                specs: input.specs ?? undefined,
            });
            if (!check.valid) continue; // 单条异常不阻断整体
            await rtRepo.save(rtRepo.create(input as any));
            inserted++;
        }
        return inserted;
    }

    /**
     * 套用模板 → 深拷贝快照进变体 customFields hotelRoomConfig。
     * 之后模板修改不影响本变体；变体侧可再编辑快照。
     */
    async applyToVariant(ctx: RequestContext, variantId: ID, templateId: ID): Promise<boolean> {
        const template = await this.connection
            .getRepository(ctx, RoomTemplate)
            .findOne({ where: { id: templateId } as any });
        if (!template) throw new Error(`RoomTemplate ${templateId} 不存在`);

        const snapshot: HotelConfig = {
            templateCode: template.code,
            specs: template.specs ?? undefined,
            rooms: (template.defaultRooms ?? []).map(r => ({ ...r })),
            basePriceCent: template.basePriceCent,
            priceCalendar: (template.priceCalendar ?? []).map(s => ({ ...s, dates: s.dates ? [...s.dates] : undefined })),
            longStayDiscount: (template.longStayDiscount ?? []).map(d => ({ ...d })),
            minNights: template.minNights,
            maxNights: template.maxNights,
            advanceDays: template.advanceDays,
            checkInTime: template.checkInTime,
            checkOutTime: template.checkOutTime,
            cancelPolicy: { ...template.cancelPolicy },
            depositType: template.depositType,
        };

        const vRepo = this.connection.getRepository(ctx, ProductVariant);
        const v = await vRepo.findOne({ where: { id: variantId } as any });
        if (!v) throw new Error(`ProductVariant ${variantId} 不存在`);
        // hotelRoomConfig 为 text 类型（Vendure 3.6 无 json 自定义字段类型），存 JSON 字符串，读取端 JSON.parse
        (v as any).customFields = { ...((v as any).customFields ?? {}), hotelRoomConfig: JSON.stringify(snapshot) };
        await vRepo.save(v);
        return true;
    }
}
