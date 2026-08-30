import { Injectable } from '@nestjs/common';
import { ChannelService, ID, Product, ProductOptionGroup, RequestContext, TransactionalConnection } from '@vendure/core';

@Injectable()
export class TenantOptionGroupService {
    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
    ) {}

    /** 取某组当前语言的名称（从 translations 抽 zh_Hans，回退首个）。 */
    private groupName(g: any): string {
        const ts = (g.translations ?? []) as Array<{ languageCode: string; name: string }>;
        return (
            ts.find((t) => t.languageCode === 'zh_Hans')?.name ||
            ts.find((t) => t.name)?.name ||
            String(g.id)
        );
    }

    private optionName(o: any): string {
        const ts = (o.translations ?? []) as Array<{ languageCode: string; name: string }>;
        return (
            ts.find((t) => t.languageCode === 'zh_Hans')?.name ||
            ts.find((t) => t.name)?.name ||
            String(o.id)
        );
    }

    /** 返回「本租户渠道私有组 + 默认渠道平台组」并集（跨渠道只读，不改归属）。 */
    async reusableOptionGroups(
        ctx: RequestContext,
    ): Promise<
        Array<{ id: ID; name: string; options: Array<{ id: ID; name: string }> }>
    > {
        const [defaultChannel, groups] = await Promise.all([
            this.channelService.getDefaultChannel(ctx),
            this.connection.rawConnection.getRepository(ProductOptionGroup).find({
                relations: ['channels', 'options', 'options.translations', 'translations'],
            }),
        ]);
        const defaultId = String(defaultChannel?.id ?? '');
        const tenantId = String(ctx.channelId ?? '');
        const out: Array<{ id: ID; name: string; options: Array<{ id: ID; name: string }> }> = [];
        for (const g of groups as any[]) {
            const chans: Array<{ id: ID }> = g.channels ?? [];
            const has = (id: string) => id && chans.some((c) => String(c.id) === id);
            const onTenant = has(tenantId);
            const onDefault = has(defaultId);
            const unattached = chans.length === 0;
            // 平台组判定：本租户私有组 或 平台组（挂在默认渠道） 或 未挂任何渠道的组
            if (onTenant || onDefault || unattached) {
                out.push({
                    id: g.id,
                    name: this.groupName(g),
                    options: ((g.options ?? []) as any[]).map((o) => ({
                        id: o.id,
                        name: this.optionName(o),
                    })),
                });
            }
        }
        return out;
    }

    /** 把已有规格组直接绑定到商品（跨渠道直连 Product.optionGroups，幂等）。 */
    async reuseOptionGroupForProduct(productId: ID, optionGroupId: ID): Promise<boolean> {
        const groupRepo = this.connection.rawConnection.getRepository(ProductOptionGroup);
        const productRepo = this.connection.rawConnection.getRepository(Product);
        const group = await groupRepo.findOne({
            where: { id: String(optionGroupId) },
            relations: ['options'],
        });
        if (!group) return false;
        const product = await productRepo.findOne({
            where: { id: String(productId) },
            relations: ['optionGroups'],
        });
        if (!product) return false;
        const existing = (product.optionGroups ?? []).some((g: any) => String(g.id) === String(group.id));
        if (!existing) {
            product.optionGroups.push(group as any);
            await productRepo.save(product, { reload: false });
        }
        return true;
    }
}