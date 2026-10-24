import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { AdminNotifyEvent } from '@vendure/notification-plugin';

import { FeishuCardService } from './feishu-card.service';
import { FeishuClient } from './feishu.client';
import { formatPush } from './feishu.templates';

const loggerCtx = 'Feishu';
const DEDUPE_MS = 2 * 60_000;

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
        // 缺省键必须带事件标题：同一订单 2 分钟内可能连发多个不同事件（如取货超时告警 + 回厅），
        // 只用 orderCode 会把后到的那条吞掉。显式传键的调用方保持原语义。
        const key = dedupeKey ?? (orderCode ? `${orderCode}:${title}` : undefined);
        if (key && this.isDuplicate(key)) return;

        // P2.1 同单告警合并：有 orderCode 时先尝试 PATCH 已有订单卡片追加告警行，找不到再降级广播文本
        if (orderCode) {
            const alertText = `${title} · ${content}`;
            // Bug 2 修复：把 dedupeKey 透传给 appendAlert，用于精确匹配（同告警类型但内容不同如 13→14min 会追加新行）
            const alertDedupeKey = key ?? dedupeKey;
            if (await this.cards.appendAlert(orderCode, alertText, alertDedupeKey)) {
                // 已合并到卡片，不再额外发文本
                return;
            }
        }

        await this.push(scene, key, formatPush({ scene, title, content, orderCode, at: Date.now() }));
    }

    private async deliver(text: string, scene: string): Promise<void> {
        try {
            const ok = await this.client.broadcast(text);
            if (!ok) Logger.warn(`飞书推送未送达 scene=${scene}`, loggerCtx);
        } catch (e: any) {
            Logger.warn(`飞书推送异常 scene=${scene}: ${e?.message ?? e}`, loggerCtx);
        }
    }

    // Bug 6 修复：同 Bug 5，Map 遍历时 delete 跳过元素导致泄漏；改数组收集再统一 delete
    private isDuplicate(key: string): boolean {
        const now = Date.now();
        const expired: string[] = [];
        for (const [k, at] of this.recent) {
            if (now - at > DEDUPE_MS) expired.push(k);
        }
        for (const k of expired) this.recent.delete(k);
        const seen = this.recent.get(key);
        if (seen && now - seen <= DEDUPE_MS) return true;
        this.recent.set(key, now);
        return false;
    }
}
