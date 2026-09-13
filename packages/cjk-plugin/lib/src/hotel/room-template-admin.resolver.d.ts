import { ID, RequestContext } from '@vendure/core';
import { RoomTemplateService } from './room-template.service';
import { RoomTemplate } from './room-template.entity';
export declare class RoomTemplateAdminResolver {
    private roomTemplateService;
    constructor(roomTemplateService: RoomTemplateService);
    roomTemplates(): Promise<RoomTemplate[]>;
    roomTemplate(id: ID): Promise<RoomTemplate | undefined>;
    createRoomTemplate(input: any): Promise<RoomTemplate>;
    updateRoomTemplate(id: ID, input: any): Promise<RoomTemplate>;
    deleteRoomTemplate(id: ID): Promise<boolean>;
    applyRoomTemplate(ctx: RequestContext, variantId: ID, templateId: ID): Promise<boolean>;
}
