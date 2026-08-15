import { Injectable } from '@nestjs/common';
import { RequestContext, ChannelService } from '@vendure/core';
import type { BasicConfig } from './tenant-config.types';

interface BasicConfigStruct {
    tenantName?: string | null;
    contactPhone?: string | null;
    address?: string | null;
    invoiceHeaderJson?: string | null;
    serviceContactsJson?: string | null;
    timeZoneId?: string | null;
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
export class BasicConfigService {
    constructor(private channelService: ChannelService) {}

    private parseStruct(raw: BasicConfigStruct | undefined): BasicConfig | null {
        if (!raw) return null;
        const out: BasicConfig = {};
        if (raw.tenantName != null) out.tenantName = raw.tenantName;
        if (raw.contactPhone != null) out.contactPhone = raw.contactPhone;
        if (raw.address != null) out.address = raw.address;
        if (raw.timeZoneId != null) out.timeZoneId = raw.timeZoneId;
        const invoiceHeader = parseJson<NonNullable<BasicConfig['invoiceHeader']>>(raw.invoiceHeaderJson);
        if (invoiceHeader) out.invoiceHeader = invoiceHeader;
        const serviceContacts = parseJson<NonNullable<BasicConfig['serviceContacts']>>(raw.serviceContactsJson);
        if (serviceContacts) out.serviceContacts = serviceContacts;
        return Object.keys(out).length > 0 ? out : null;
    }

    private serializeDomain(domain: BasicConfig | null): BasicConfigStruct {
        return {
            tenantName: domain?.tenantName ?? null,
            contactPhone: domain?.contactPhone ?? null,
            address: domain?.address ?? null,
            timeZoneId: domain?.timeZoneId ?? null,
            invoiceHeaderJson: stringify(domain?.invoiceHeader),
            serviceContactsJson: stringify(domain?.serviceContacts),
        };
    }

    async get(ctx: RequestContext, channelId: string): Promise<BasicConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const raw = ((channel as any).customFields?.basicConfig as BasicConfigStruct | undefined);
        return this.parseStruct(raw);
    }

    async update(ctx: RequestContext, channelId: string, patch: BasicConfig | null): Promise<BasicConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const original = this.parseStruct(((channel as any).customFields?.basicConfig as BasicConfigStruct | undefined)) || {};
        const merged: BasicConfig = { ...original, ...(patch || {}) };
        await this.channelService.update(ctx, { id: channelId as any, customFields: { basicConfig: this.serializeDomain(merged) } });
        return merged;
    }
}