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

        // 使用 emptyCtx 跨 channel 查询，避免公共请求 ctx 的潜在 channel 过滤
        // 与 group-buy-plugin / distribution-plugin 的既定模式一致
        const emptyCtx = RequestContext.empty();
        const channels = await this.channelService.findAll(emptyCtx);
        for (const channel of channels.items) {
            const domains = (channel.customFields as any)?.customDomains as string[] | undefined;
            if (domains?.some(d => d.toLowerCase() === normalizedHost)) {
                return { token: channel.token, code: channel.code };
            }
        }
        return null;
    }
}
