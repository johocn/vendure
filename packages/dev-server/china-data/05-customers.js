"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateCustomers = populateCustomers;
const core_1 = require("@vendure/core");
const shared_1 = require("./shared");
const sources_1 = require("./sources");
async function populateCustomers(app) {
    const channelService = app.get(core_1.ChannelService);
    const customerService = app.get(core_1.CustomerService);
    const defaultChannel = await channelService.getDefaultChannel();
    // 查询 shop-a Channel（需在 default Channel ctx 下调用 findAll）
    const allChannels = await channelService.findAll(await (0, shared_1.createAdminCtx)(app, defaultChannel));
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a');
    if (!shopAChannel)
        throw new Error('shop-a channel not found');
    for (const c of sources_1.CUSTOMERS) {
        const targetChannel = c.channel === 'default' ? defaultChannel : shopAChannel;
        await (0, shared_1.withCtx)(app, targetChannel, async (ctx) => {
            // 1. 创建客户（含密码便于后续登录下单）
            const created = await customerService.create(ctx, {
                firstName: c.firstName,
                lastName: c.lastName,
                phoneNumber: c.phoneNumber,
                emailAddress: c.emailAddress,
            }, 'test');
            if ((0, core_1.isGraphQlErrorResult)(created)) {
                throw new Error(`Failed to create customer ${c.emailAddress}: ${created.message}`);
            }
            // 2. 创建地址（CreateAddressInput 用 countryCode，对应 stage1 创建的 CN）
            await customerService.createAddress(ctx, created.id, {
                fullName: `${c.lastName}${c.firstName}`,
                streetLine1: c.address.streetLine1,
                city: c.address.city,
                province: c.address.province,
                postalCode: c.address.postalCode,
                countryCode: 'CN',
                defaultShippingAddress: true,
                defaultBillingAddress: true,
            });
            // 3. 写入余额
            // CustomerBalance 实体有 @ManyToOne(() => Customer) 外键约束，
            // 但 plugin 的 getBalance/deductBalance 用 User.id 查询（plugin bug）。
            // 此处用 Customer.id 满足外键约束；balance-pay 订单已改为 dummy-payment，余额仅用于展示。
            if (c.balance > 0) {
                const conn = app.get(core_1.TransactionalConnection);
                const customerRow = await conn.rawConnection.query(`SELECT id FROM customer WHERE "emailAddress" = $1 LIMIT 1`, [c.emailAddress]);
                if (customerRow && customerRow.length > 0) {
                    await setCustomerBalance(app, ctx, customerRow[0].id, (0, shared_1.yuanToCents)(c.balance));
                }
            }
        });
    }
}
async function setCustomerBalance(app, ctx, customerId, amount) {
    // 使用 Customer.id 满足 @ManyToOne(() => Customer) 外键约束
    const conn = app.get(core_1.TransactionalConnection);
    const existing = await conn.rawConnection.query(`SELECT id FROM customer_balance WHERE "customerId" = $1 AND "channelId" = $2 LIMIT 1`, [customerId, ctx.channelId]);
    if (existing && existing.length > 0) {
        await conn.rawConnection.query(`UPDATE customer_balance SET balance = $1 WHERE "customerId" = $2 AND "channelId" = $3`, [amount, customerId, ctx.channelId]);
    }
    else {
        await conn.rawConnection.query(`INSERT INTO customer_balance ("customerId", "channelId", "balance", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())`, [customerId, ctx.channelId, amount]);
    }
}
//# sourceMappingURL=05-customers.js.map