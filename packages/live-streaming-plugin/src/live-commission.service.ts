import { Injectable } from '@nestjs/common';
import { LiveStreamingPluginOptions } from './types';

/**
 * 占位实现：任务 4 补全支付归因分佣（复用 distribution-plugin 的 Distributor/CommissionRecord）。
 */
@Injectable()
export class LiveCommissionService {
    private opts: LiveStreamingPluginOptions = {};

    setOptions(opts: LiveStreamingPluginOptions): void {
        this.opts = opts;
    }

    init(): void {
        // 任务 4：注册 PaymentStateTransitionEvent 监听，创建主播 direct 佣金
    }
}
