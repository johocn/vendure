import { ExecutionContext, CanActivate } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
export declare class TenantEnabledGuard implements CanActivate {
    private connection;
    constructor(connection: TransactionalConnection);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
