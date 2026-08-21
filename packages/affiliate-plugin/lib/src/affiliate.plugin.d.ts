import { EventBus } from '@vendure/core';
import { AffiliatePluginOptions } from './affiliate.options';
import { AffiliateService } from './affiliate.service';
export declare class AffiliatePlugin {
    private options;
    private service;
    private eventBus;
    private static options;
    static init(options?: AffiliatePluginOptions): typeof AffiliatePlugin;
    constructor(options: AffiliatePluginOptions, service: AffiliateService, eventBus: EventBus);
    /**
     * 事件订阅：
     * - Order 送达(Delivered) → 生成订单佣金；
     * - 退款成功(Settled) → 回滚该单 pending 佣金。
     */
    onApplicationBootstrap(): void;
}
