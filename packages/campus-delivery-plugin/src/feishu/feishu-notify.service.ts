import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { AdminNotifyEvent } from '@vendure/notification-plugin';

import { FeishuCardService } from './feishu-card.service';
import { FeishuClient } from './feishu.client';
import { formatPush } from './feishu.templates';

const loggerCtx = 'Feishu';
const DEDUPE_MS = 5 * 60_000;

/**
 * 管理侧外发：订阅 notification-plugin 的 AdminNotifyEvent，把新订单/售后推到飞书群；
 * 新订单优先发订单卡片（尾号 + 按钮 + 话题归集），卡片失败再降级为文本；
 * 外卖插件内部的异常/超时也走 push() 复用同一条通道。
 * 未启用、未配置、发送失败一律静默降级，绝不阻塞订单主流程。
 */
@Injectable()
export class FeishuNotifyService {
    private recent = new Map<string, number>();

    constructor(
        private client: FeishuClient,
        private cards: FeishuCardService,
    ) {}

    async onAdminNotify(event: AdminNotifyEvent): Promise<void> {
        if (!this.client.enabled) return;
        const dedupeKey = event.orderCode || event.orderId != null
            ? `${event.scene}:${event.orderId != null ? String(event.orderId) : event.orderCode}`
            : undefined;
        if (dedupeKey && this.isDuplicate(dedupeKey)) return;

        if (event.scene === 'shop_new_order' && event.orderCode) {
            try {
                if (await this.cards.broadcastOrderCard(event.orderCode)) return;
            } catch (e: any) {
                Logger.warn(`新订单卡片发送失败，降级文本：${e?.message ?? e}`, loggerCtx);
            }
        }

        const link = event.link
            ? `${process.env.ADMIN_UI_BASE_URL || 'https://e.joho.cn'}${event.link.startsWith('/') ? '' : '/'}${event.link}`
            : undefined;
        const text = formatPush({
            scene: event.scene,
            title: event.title,
            content: event.content,
            orderCode: event.orderCode,
            link,
            at: Date.now(),
        });
        await this.deliver(text, event.scene);
    }

    /** 内部事件（异常/超时/支付取消）直接推群；按业务键 5 分钟去重 */
    async push(scene: string, dedupeKey: string | undefined, text: string): Promise<void> {
        if (!this.client.enabled) return;
        if (dedupeKey && this.isDuplicate(`${scene}:${dedupeKey}`)) return;
        await this.deliver(text, scene);
    }

    async pushEvent(scene: string, title: string, content: string, orderCode?: string, dedupeKey?: string): Promise<void> {
        await this.push(scene, dedupeKey ?? orderCode, formatPush({ scene, title, content, orderCode, at: Date.now() }));
    }

    private async deliver(text: string, scene: string): Promise<void> {
        try {
            const ok = await this.client.broadcast(text);
            if (!ok) Logger.warn(`飞书推送未送达 scene=${scene}`, loggerCtx);
        } catch (e: any) {
            Logger.warn(`飞书推送异常 scene=${scene}: ${e?.message ?? e}`, loggerCtx);
        }
    }

    private isDuplicate(key: string): boolean {
        const now = Date.now();
        for (const [k, at] of this.recent) {
            if (now - at > DEDUPE_MS) this.recent.delete(k);
        }
        const seen = this.recent.get(key);
        if (seen && now - seen <= DEDUPE_MS) return true;
        this.recent.set(key, now);
        return false;
    }
}
