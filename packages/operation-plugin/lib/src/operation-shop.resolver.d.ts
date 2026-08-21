import { RequestContext } from '@vendure/core';
import { OperationItem } from './operation-item.entity';
import { OperationSection } from './operation-section.entity';
import { OperationService } from './operation.service';
export declare class OperationShopResolver {
    private operationService;
    constructor(operationService: OperationService);
    operationSections(ctx: RequestContext): Promise<OperationSection[]>;
    operationSection(ctx: RequestContext, code: string): Promise<OperationSection | null>;
    product(_ctx: RequestContext, item: OperationItem): Promise<any>;
    imageUrl(_ctx: RequestContext, item: OperationItem): Promise<string | null>;
}
