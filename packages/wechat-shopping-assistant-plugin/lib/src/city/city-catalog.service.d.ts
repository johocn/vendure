import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CityIndex } from './city-catalog';
export declare class CityCatalogService {
    private readonly connection;
    private cache;
    constructor(connection: TransactionalConnection);
    getIndex(ctx: RequestContext): Promise<CityIndex>;
    /** 渠道字段变更后立即失效（后台保存时调用） */
    invalidate(): void;
}
