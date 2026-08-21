import { ID, RequestContext } from '@vendure/core';
import { OperationService } from './operation.service';
export declare class OperationAdminResolver {
    private operationService;
    constructor(operationService: OperationService);
    operationSections(ctx: RequestContext): Promise<any[]>;
    operationSection(ctx: RequestContext, code: string): Promise<any>;
    createOperationSection(ctx: RequestContext, input: any): Promise<any>;
    updateOperationSection(ctx: RequestContext, id: ID, input: any): Promise<any>;
    deleteOperationSection(ctx: RequestContext, id: ID): Promise<boolean>;
    setOperationItems(ctx: RequestContext, sectionId: ID, items: any[]): Promise<any[]>;
}
