import { RequestContext, TransactionalConnection } from '@vendure/core';
import { SearchAssistType } from './search-assist';
export interface CampusSearchAssistResultShape {
    ok: boolean;
    type: SearchAssistType;
    provider: string;
    text: string;
    keywords: string[];
    latencyMs: number;
    error: string | null;
}
export declare class SearchAssistService {
    private connection;
    constructor(connection: TransactionalConnection);
    assist(ctx: RequestContext, type: string, payload?: string | null): Promise<CampusSearchAssistResultShape>;
}
