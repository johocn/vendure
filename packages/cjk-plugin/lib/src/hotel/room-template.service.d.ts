import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { RoomTemplate } from './room-template.entity';
export declare class RoomTemplateService {
    private connection;
    constructor(connection: TransactionalConnection);
    findAll(): Promise<RoomTemplate[]>;
    findOne(id: ID): Promise<RoomTemplate | undefined>;
    create(input: any): Promise<RoomTemplate>;
    update(id: ID, input: any): Promise<RoomTemplate>;
    delete(id: ID): Promise<void>;
    /**
     * 套用模板 → 深拷贝快照进变体 customFields hotelRoomConfig。
     * 之后模板修改不影响本变体；变体侧可再编辑快照。
     */
    applyToVariant(ctx: RequestContext, variantId: ID, templateId: ID): Promise<boolean>;
}
