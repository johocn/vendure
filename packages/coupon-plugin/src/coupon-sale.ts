/**
 * 券出售相关的纯函数（无 IO、SSR 可用）：
 * 退款判定、券包展开、出售目录过滤。
 */

/**
 * 出售单可退判定：出售单生成的券中「没有任何一张状态为 USED」即可退。
 * 过期券（EXPIRED）与回退券（RETURNED）均视为未使用（设计 §16-5：过期券可退）。
 * 空集合（异常数据，无券可回收）→ 拒绝，避免空退款。
 */
export function isSaleOrderRefundable(
    statuses: ReadonlyArray<string | null | undefined>,
): boolean {
    if (statuses.length === 0) {
        return false;
    }
    return statuses.every(s => s !== 'USED');
}

/**
 * 券包展开：把 [{templateId, quantity}] 展开为逐张的 templateId 序列。
 * quantity 缺省 / 非法 / 小于 1 时按 1 张处理。
 */
export function expandBundleItems(
    items: ReadonlyArray<{ templateId: number; quantity?: number | null }>,
): number[] {
    const out: number[] = [];
    for (const item of items) {
        const qty = Math.max(1, Math.floor(Number(item.quantity ?? 1)) || 1);
        for (let i = 0; i < qty; i++) {
            out.push(item.templateId);
        }
    }
    return out;
}

/** 出售目录过滤：仅保留 salePrice > 0 的可售模板（0 / null = 不可售）。 */
export function filterSaleCatalogue<T extends { salePrice?: number | null }>(
    templates: ReadonlyArray<T>,
): T[] {
    return templates.filter(t => Number(t.salePrice ?? 0) > 0);
}

/**
 * 到手价重算（下单唯一信任源，纯函数）：
 * 学生价（仅单券，需认证通过）与首购立减（单券+券包）各自从原价计算、取低不叠加；
 * 到手价最低 1 分（避免 0 元单）。返回终价 + 优惠类型 + 让利额。
 */
export function resolvePromoPrice(
    base: number,
    opts: {
        studentPrice?: number | null;
        studentApproved: boolean;
        firstBuyEligible: boolean;
        firstBuyDiscount: number;
    },
): { final: number; discountType: 'FIRST_BUY' | 'STUDENT' | null; discountAmount: number } {
    const baseFinal = Math.max(1, Math.floor(Number(base) || 0));
    // 两条优惠路径各自从原价独立计算（取低不叠加），同价时优先记为学生价
    const studentPrice = Math.floor(Number(opts.studentPrice ?? 0));
    const candidates: Array<{ final: number; type: 'FIRST_BUY' | 'STUDENT' }> = [];
    if (studentPrice > 0 && opts.studentApproved && studentPrice < baseFinal) {
        candidates.push({ final: Math.max(1, studentPrice), type: 'STUDENT' });
    }
    if (opts.firstBuyDiscount > 0 && opts.firstBuyEligible) {
        const v = Math.max(1, baseFinal - Math.floor(opts.firstBuyDiscount));
        if (v < baseFinal) {
            candidates.push({ final: v, type: 'FIRST_BUY' });
        }
    }
    if (!candidates.length) {
        return { final: baseFinal, discountType: null, discountAmount: 0 };
    }
    const best = candidates.reduce((a, b) => (b.final < a.final ? b : a));
    return { final: best.final, discountType: best.type, discountAmount: baseFinal - best.final };
}