import { INestApplication, Logger } from '@nestjs/common';
import {
    ChannelService,
    CustomerService,
    isGraphQlErrorResult,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import { CustomerBalance } from '@vendure/recharge-card-plugin';

import { withCtx, yuanToCents } from './shared';
import { CUSTOMERS } from './sources';

const loggerCtx = 'PopulateChina';

export async function populateCustomers(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const customerService = app.get(CustomerService);
    const defaultChannel = await channelService.getDefaultChannel();

    // 查询 shop-a Channel（需在 default Channel ctx 下调用 findAll）
    const allChannels = await channelService.findAll(
        await app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: defaultChannel }),
    );
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a');
    if (!shopAChannel) throw new Error('shop-a channel not found');

    for (const c of CUSTOMERS) {
        const targetChannel = c.channel === 'default' ? defaultChannel : shopAChannel;
        await withCtx(app, targetChannel, async (ctx: RequestContext) => {
            // 1. 创建客户（含密码便于后续登录下单）
            const created = await customerService.create(
                ctx,
                {
                    firstName: c.firstName,
                    lastName: c.lastName,
                    phoneNumber: c.phoneNumber,
                    emailAddress: c.emailAddress,
                },
                'test',
            );
            if (isGraphQlErrorResult(created)) {
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
            // 注意：CustomerBalance.customerId 列实际存储的是 User.id（与 balance-pay handler 一致）
            if (c.balance > 0 && created.user?.id) {
                await setCustomerBalance(app, ctx, created.user.id as number, yuanToCents(c.balance));
            }
        });
    }
}

async function setCustomerBalance(
    app: INestApplication,
    ctx: RequestContext,
    userId: number,
    amount: number,
): Promise<void> {
    // 优先用 RechargeCardService.addBalance（与生产路径一致）
    try {
        const rechargeCardService = app.get('RechargeCardService') as {
            addBalance(ctx: RequestContext, customerId: any, amount: number): Promise<number>;
        };
        await rechargeCardService.addBalance(ctx, userId, amount);
        return;
    } catch (e: any) {
        Logger.warn(
            `RechargeCardService.addBalance failed, fallback to direct repo: ${e?.message}`,
            loggerCtx,
        );
    }

    // 回退：直接操作 CustomerBalance 表
    const conn = app.get(TransactionalConnection);
    const repo = conn.getRepository(ctx, CustomerBalance);
    let record = await repo.findOne({
        where: { customerId: userId as any, channelId: ctx.channelId as any },
    });
    if (!record) {
        record = new CustomerBalance({
            customerId: userId as any,
            channelId: ctx.channelId as any,
            balance: 0,
        });
    }
    record.balance = amount;
    await repo.save(record);
}
