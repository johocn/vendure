import { Injectable, Inject } from '@nestjs/common';
import { Logger, RequestContext, UnauthorizedError, UserInputError } from '@vendure/core';
import { getAuthOverride } from '@vendure/cjk-plugin';
import { WechatAuthService } from './wechat-auth.service';
import { WechatAuthPluginOptions } from './types';
import { WECHAT_AUTH_PLUGIN_OPTIONS, loggerCtx } from './constants';

interface RateLimitRecord {
    count: number;
    resetAt: number;
}

@Injectable()
export class WxacodeService {
    private userCallCount = new Map<string, RateLimitRecord>();
    private readonly MAX_CALLS_PER_MINUTE = 10;

    constructor(
        private wechatAuthService: WechatAuthService,
        @Inject(WECHAT_AUTH_PLUGIN_OPTIONS) private options: WechatAuthPluginOptions,
    ) {}

    async generateWxacode(ctx: RequestContext, args: {
        scene: string;
        path?: string;
        width?: number;
    }): Promise<{ contentType: string; base64: string }> {
        // 1. 鉴权
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }

        // 2. 参数校验
        if (args.scene.length > 32) {
            throw new UserInputError('scene 参数不能超过 32 字符');
        }

        // 3. 频次限制
        this.checkRateLimit(String(ctx.activeUserId));

        // 4. 获取租户级小程序凭证（getAuthOverride 是同步函数）
        const override = getAuthOverride(ctx, 'wechat');
        const appId = override?.miniProgramAppId || this.options.miniProgramAppId;
        const appSecret = override?.miniProgramAppSecret || this.options.miniProgramAppSecret;

        if (!appId || !appSecret) {
            throw new Error('小程序凭证未配置');
        }

        // 5. 获取 access_token
        const accessToken = await this.wechatAuthService.getMiniProgramAccessToken(appId, appSecret);

        // 6. 调用微信 getwxacodeunlimit 接口
        const response = await fetch('https://api.weixin.qq.com/wxa/getwxacodeunlimit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                access_token: accessToken,
                scene: args.scene,
                page: args.path,
                width: args.width || 430,
                env_version: 'release',
                check_path: false,
            }),
        });

        // 7. 处理响应
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('image/')) {
            const buffer = Buffer.from(await response.arrayBuffer());
            return {
                contentType,
                base64: buffer.toString('base64'),
            };
        }

        // 错误响应
        const errorBody = (await response.json()) as any;
        Logger.error(`WeChat wxacode failed: ${JSON.stringify(errorBody)}`, loggerCtx);
        throw new Error(`微信小程序码生成失败: ${errorBody.errcode} ${errorBody.errmsg}`);
    }

    private checkRateLimit(userId: string): void {
        const now = Date.now();
        const record = this.userCallCount.get(userId);

        if (!record || record.resetAt < now) {
            this.userCallCount.set(userId, { count: 1, resetAt: now + 60_000 });
            return;
        }

        if (record.count >= this.MAX_CALLS_PER_MINUTE) {
            throw new Error('调用过于频繁，请稍后再试');
        }
        record.count++;
    }
}
