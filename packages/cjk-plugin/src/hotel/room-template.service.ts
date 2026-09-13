import { Injectable } from '@nestjs/common';
import { ID, ProductVariant, RequestContext, TransactionalConnection } from '@vendure/core';
import { RoomTemplate } from './room-template.entity';
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
        await repo.remove(entity);
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
        (v as any).customFields = { ...((v as any).customFields ?? {}), hotelRoomConfig: snapshot };
        await vRepo.save(v);
        return true;
    }
}
