"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateShippingTemplates = populateShippingTemplates;
const core_1 = require("@vendure/core");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const shared_1 = require("./shared");
const sources_1 = require("./sources");
async function populateShippingTemplates(app) {
    const channelService = app.get(core_1.ChannelService);
    const conn = app.get(core_1.TransactionalConnection);
    const defaultChannel = await channelService.getDefaultChannel();
    await (0, shared_1.withCtx)(app, defaultChannel, async (ctx) => {
        const shippingTemplateService = app.get(cjk_plugin_1.ShippingTemplateService);
        const repo = conn.rawConnection.getRepository(cjk_plugin_1.ShippingTemplate);
        for (const tpl of sources_1.GLOBAL_SHIPPING_TEMPLATES) {
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
            }
            else {
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
//# sourceMappingURL=08-shipping-templates.js.map