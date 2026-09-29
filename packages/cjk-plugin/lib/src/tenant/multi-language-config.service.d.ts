import { RequestContext, ChannelService } from '@vendure/core';
export interface MultiLanguageConfig {
    availableLanguageCodes?: string[];
    defaultLanguageCode?: string;
    translationWorkflowEnabled?: boolean;
    operationalCopy?: {
        tenantName?: string[];
        serviceNotice?: string[];
        invoiceHeader?: string[];
    };
}
export declare class MultiLanguageConfigService {
    private channelService;
    constructor(channelService: ChannelService);
    private parseStruct;
    private serializeDomain;
    get(ctx: RequestContext, channelId: string): Promise<MultiLanguageConfig | null>;
    update(ctx: RequestContext, channelId: string, patch: MultiLanguageConfig | null): Promise<MultiLanguageConfig | null>;
}
