import { Injectable } from '@nestjs/common';
import { RequestContext, ChannelService, LanguageCode } from '@vendure/core';

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

interface MultiLanguageConfigStruct {
    availableLanguageCodes?: string[] | null;
    defaultLanguageCode?: string | null;
    translationWorkflowEnabled?: boolean | null;
    operationalCopyJson?: string | null;
}

function parseJson<T>(value: string | null | undefined): T | undefined {
    if (!value) return undefined;
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

function stringify(value: unknown): string | null {
    return value == null ? null : JSON.stringify(value);
}

@Injectable()
export class MultiLanguageConfigService {
    constructor(private channelService: ChannelService) {}

    private parseStruct(raw: MultiLanguageConfigStruct | undefined): MultiLanguageConfig | null {
        if (!raw) return null;
        const out: MultiLanguageConfig = {};
        if (raw.availableLanguageCodes) out.availableLanguageCodes = raw.availableLanguageCodes;
        if (raw.defaultLanguageCode != null) out.defaultLanguageCode = raw.defaultLanguageCode;
        if (raw.translationWorkflowEnabled != null) out.translationWorkflowEnabled = raw.translationWorkflowEnabled;
        const operationalCopy = parseJson<NonNullable<MultiLanguageConfig['operationalCopy']>>(raw.operationalCopyJson);
        if (operationalCopy) out.operationalCopy = operationalCopy;
        return Object.keys(out).length > 0 ? out : null;
    }

    private serializeDomain(domain: MultiLanguageConfig | null): MultiLanguageConfigStruct {
        return {
            availableLanguageCodes: domain?.availableLanguageCodes ?? null,
            defaultLanguageCode: domain?.defaultLanguageCode ?? null,
            translationWorkflowEnabled: domain?.translationWorkflowEnabled ?? null,
            operationalCopyJson: stringify(domain?.operationalCopy),
        };
    }

    async get(ctx: RequestContext, channelId: string): Promise<MultiLanguageConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const raw = ((channel as any).customFields?.multiLanguageConfig as MultiLanguageConfigStruct | undefined);
        return this.parseStruct(raw);
    }

    async update(
        ctx: RequestContext,
        channelId: string,
        patch: MultiLanguageConfig | null,
    ): Promise<MultiLanguageConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const original = this.parseStruct(((channel as any).customFields?.multiLanguageConfig as MultiLanguageConfigStruct | undefined)) || {};
        const merged: MultiLanguageConfig = { ...original, ...(patch || {}) };
        await this.channelService.update(ctx, { id: channelId as any, customFields: { multiLanguageConfig: this.serializeDomain(merged) } });

        // 同步写 Vendure 原生渠道语言字段
        if (patch?.availableLanguageCodes || patch?.defaultLanguageCode) {
            const updateInput: any = {};
            if (patch.availableLanguageCodes?.length) {
                updateInput.availableLanguageCodes = patch.availableLanguageCodes as LanguageCode[];
            }
            if (patch.defaultLanguageCode) {
                updateInput.defaultLanguageCode = patch.defaultLanguageCode as LanguageCode;
            }
            await this.channelService.update(ctx, { id: channelId as any, ...updateInput });
        }
        return merged;
    }
}