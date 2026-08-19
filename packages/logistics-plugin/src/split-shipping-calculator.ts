import { LanguageCode, Order, ShippingCalculator, TransactionalConnection } from '@vendure/core';

const DEFAULT_BASE_FEE = 1000; // 分
const DEFAULT_PER_KM = 200; // 分/公里

interface PackageShippingRule {
    locationId: string;
    baseFee: number; // 分
    perKmFee: number; // 分/公里
    freeThreshold: number; // 订单金额阈值（分），超阈值免运费
}

/** 供计费落库使用的连接（init 注入） */
let connection: TransactionalConnection | undefined;

/**
 * 每包裹独立计费：读取订单拆分明细 stockLocationsJson，
 * 逐包按 channel 级 packageShippingRule 计费后合计为一笔运费。
 * 计费结果明细写入 Order.packageShippingJson，供前端「运费明细」区块展示。
 */
export const splitShippingCalculator = new ShippingCalculator({
    code: 'split-package-shipping',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '多仓拆单每包裹独立计费' },
        { languageCode: LanguageCode.en, value: 'Split Package Shipping Calculator' },
    ],
    args: {},
    init(injector) {
        connection = injector.get(TransactionalConnection);
    },
    calculate: async (ctx, order, args) => {
        const ccf = ((ctx.channel as any)?.customFields ?? {}) as Record<string, any>;
        const rules = parseRules(ccf.packageShippingRule);
        const lines = collectLines(order);
        if (lines.length === 0) {
            return { price: 0, priceIncludesTax: true, taxRate: 0 };
        }
        let total = 0;
        const detail: Array<{ locationId: string; fee: number }> = [];
        for (const loc of lines) {
            const rule = rules.find(r => String(r.locationId) === String(loc.locationId));
            const base = rule?.baseFee ?? DEFAULT_BASE_FEE;
            const perKm = rule?.perKmFee ?? DEFAULT_PER_KM;
            const freeThreshold = rule?.freeThreshold ?? 0;
            if (freeThreshold > 0 && order.subTotal >= freeThreshold) {
                total += 0;
                detail.push({ locationId: String(loc.locationId), fee: 0 });
                continue;
            }
            const distance = loc.distanceKm ?? 0;
            const fee = base + Math.round(perKm * distance);
            total += fee;
            detail.push({ locationId: String(loc.locationId), fee });
        }
        await persistPackageShipping(ctx, order, detail);
        return { price: total, priceIncludesTax: true, taxRate: 0 };
    },
});

function collectLines(order: OrderLike): Array<{ locationId: string; distanceKm: number }> {
    const out: Array<{ locationId: string; distanceKm: number }> = [];
    const seen = new Set<string>();
    for (const line of (order.lines ?? []) as any[]) {
        const raw = (line.customFields as any)?.stockLocationsJson;
        let detail: Array<{ locationId: string; quantity: number }> = [];
        try {
            detail = Array.isArray(raw) ? raw : JSON.parse(String(raw ?? '[]'));
        } catch {
            detail = [];
        }
        for (const d of detail) {
            if (!seen.has(d.locationId)) {
                seen.add(d.locationId);
                out.push({ locationId: d.locationId, distanceKm: 0 });
            }
        }
    }
    return out;
}

function parseRules(raw: unknown): PackageShippingRule[] {
    try {
        const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw ?? '[]'));
        return Array.isArray(arr) ? (arr as PackageShippingRule[]) : [];
    } catch {
        return [];
    }
}

async function persistPackageShipping(
    ctx: any,
    order: OrderLike,
    detail: Array<{ locationId: string; fee: number }>,
): Promise<void> {
    try {
        if (!connection) {
            return;
        }
        const cf = {
            ...((order.customFields as any) ?? {}),
            packageShippingJson: JSON.stringify(detail),
        };
        const repo = connection.getRepository(ctx, Order);
        const fresh = await repo.findOne({ where: { id: order.id as any } });
        if (fresh) {
            fresh.customFields = cf;
            await repo.save(
                (await import('@vendure/common/lib/pick')).pick(fresh, ['id', 'customFields']) as any,
                { reload: false },
            );
        }
    } catch (e: any) {
        /* 运费明细落库失败不阻断计费 */
    }
}

type OrderLike = {
    id: any;
    subTotal: number;
    lines?: Array<{ customFields?: Record<string, any> }>;
    customFields?: Record<string, any>;
};
