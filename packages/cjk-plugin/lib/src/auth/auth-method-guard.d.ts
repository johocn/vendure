import { ExecutionContext, CanActivate } from '@nestjs/common';
import { RequestContext } from '@vendure/core';
import type { AuthMethod } from './auth-config.types';
export declare function isAuthMethodEnabled(ctx: RequestContext, method: AuthMethod): boolean;
export declare class AuthMethodGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
