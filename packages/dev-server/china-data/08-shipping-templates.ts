import { INestApplication } from '@nestjs/common';
import { ChannelService, RequestContext, TransactionalConnection } from '@vendure/core';
import { ShippingTemplate, ShippingTemplateService } from '@vendure/cjk-plugin';

import { withCtx } from './shared';
import { GLOBAL_SHIPPING_TEMPLATES } from './sources';

export async function populateShippingTemplates(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const conn = app.get(TransactionalConnection);
    const defaultChannel = await channelService.getDefaultChannel();

    await withCtx(app, defaultChannel, async (ctx: RequestContext) => {
        const shippingTemplateService = app.get(ShippingTemplateService);
        const repo = conn.rawConnection.getRepository(ShippingTemplate);

        for (const tpl of GLOBAL_SHIPPING_TEMPLATES) {
            // 幂等：检查同 code 的全局模板是否已存在
            const existing = await repo.findOne({
                where: { code: tpl.code, isGlobal: true },
            });

            if (existing) {
                // 更新已有模板
                existing.name = tpl.name;
                existing.description = tpl.description;
                existing.fulfillmentHandler = tpl.fulfillmentHandler;
                existing.checker = tpl.checker;
                existing.calculator = tpl.calculator;
                await repo.save(existing);
                console.log(`  更新全局模板: ${tpl.name}`);
            } else {
                // 通过 service 创建（自动处理 channels 关系）
                await shippingTemplateService.create(ctx, {
                    name: tpl.name,
                    description: tpl.description,
                    code: tpl.code,
                    fulfillmentHandler: tpl.fulfillmentHandler,
                    checker: tpl.checker,
                    calculator: tpl.calculator,
                    isGlobal: true,
                });
                console.log(`  创建全局模板: ${tpl.name}`);
            }
        }
    });
}
