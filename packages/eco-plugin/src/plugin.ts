import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { ECO_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { EcoEventsListener } from './eco-events.listener';
import { EcoReporter } from './eco-reporter.service';
import { EcoController } from './eco.controller';
import { EcoPluginOptions } from './types';

/**
 * 生态行为回调钩子（E5b）：
 * - purchase：监听 OrderPlacedEvent，上报下单用户的 SSO ID（targetId=订单 code）
 * - distribute：监听 distribution-plugin 的 CommissionRecordCreatedEvent，上报 inviter 的 SSO ID
 * - view_product / view_price：POST /eco/events 转发端点（供 nshop 前端调用）
 * 签名密钥/游戏地址走插件 config 或环境变量 GAME_ECO_URL / GAME_ECO_SECRET；
 * 上报为 fire-and-forget + 2s 超时 + 失败静默，绝不影响订单/佣金主流程。
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [EcoController],
    providers: [
        { provide: ECO_PLUGIN_OPTIONS, useFactory: () => EcoPlugin.options },
        EcoReporter,
        EcoEventsListener,
    ],
    compatibility: '^3.0.0',
})
export class EcoPlugin implements OnApplicationBootstrap {
    private static options: EcoPluginOptions = {};

    constructor(
        @Inject(ECO_PLUGIN_OPTIONS) private options: EcoPluginOptions,
        private listener: EcoEventsListener,
    ) {}

    static init(options?: EcoPluginOptions): Type<EcoPlugin> {
        EcoPlugin.options = options ?? {};
        return EcoPlugin;
    }

    onApplicationBootstrap(): void {
        this.listener.init();
        const configured =
            !!(EcoPlugin.options.gameUrl || process.env.GAME_ECO_URL) &&
            !!(EcoPlugin.options.secret || process.env.GAME_ECO_SECRET);
        Logger.info(
            configured
                ? 'EcoPlugin initialized'
                : 'EcoPlugin initialized（未配置 GAME_ECO_URL/GAME_ECO_SECRET，上报将静默跳过）',
            loggerCtx,
        );
    }
}
