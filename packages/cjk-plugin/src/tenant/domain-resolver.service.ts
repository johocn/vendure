import { Injectable } from '@nestjs/common';
import { ChannelService, RequestContext } from '@vendure/core';

export interface DomainResolveResult {
    token: string;
    code: string;
}

@Injectable()
export class DomainResolverService {
    constructor(private channelService: ChannelService) {}

    async resolveByDomain(ctx: RequestContext, host: string): Promise<DomainResolveResult | null> {
        const normalizedHost = host.split(':')[0].toLowerCase();

        const channels = await this.channelService.findAll(ctx);
        for (const channel of channels.items) {
            const domains = (channel.customFields as any)?.customDomains as string[] | undefined;
            if (domains?.some(d => d.toLowerCase() === normalizedHost)) {
                return { token: channel.token, code: channel.code };
            }
        }
        return null;
    }
}
