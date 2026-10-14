import { Injectable } from '@nestjs/common';
import { ChannelService, RequestContext } from '@vendure/core';
import { getAuthOverride } from '@vendure/cjk-plugin';

import { WechatCredentials } from './types';

/**
 * 渠道凭证解析：优先渠道 authConfig.wechat 覆盖（appId/appSecret），
 * 未配置则回退插件级凭证（空 appId → 主公众号）。
 */
@Injectable()
export class CredentialService {
    constructor(private channelService: ChannelService) {}

    async resolveForChannel(channelToken: string, fallback: WechatCredentials): Promise<WechatCredentials> {
        try {
            const ctx = RequestContext.empty();
            const channel = await this.channelService.findOne(ctx, channelToken as any);
            if (!channel) return fallback;
            // 对齐 wechat-message.controller 的做法：以带 channel 的伪 ctx 读取 authConfig 覆盖
            const override = getAuthOverride({ channel } as any, 'wechat');
            if (override?.appId && override?.appSecret) {
                return { appId: override.appId, appSecret: override.appSecret };
            }
        } catch {
            // 渠道/凭证解析失败按插件级凭证发送
        }
        return fallback;
    }
}
