import { KbDocument, MeiliIndexStatus, MeiliPluginOptions } from './types';
export declare class MeiliService {
    private opts;
    constructor(opts: MeiliPluginOptions);
    private req;
    indexUid(locale: string): string;
    ensureIndexes(): Promise<void>;
    upsertDocuments(locale: string, docs: KbDocument[]): Promise<void>;
    deleteDocuments(locale: string, ids: string[]): Promise<void>;
    stats(): Promise<MeiliIndexStatus[]>;
    health(): Promise<boolean>;
    triggerContentReindex(): Promise<boolean>;
}
