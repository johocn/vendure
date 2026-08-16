import { OnApplicationBootstrap } from '@nestjs/common';
import { DocumentNode } from 'graphql';
import {
    configureDefaultOrderProcess,
    DefaultProductVariantPriceUpdateStrategy,
    EntityHydrator,
    EventBus,
    OrderStateTransitionEvent,
    PluginCommonModule,
    RefundEvent,
    TransactionalConnection,
    VendurePlugin,
} from '@vendure/core';
import { MARKETPLACE_PLUGIN_OPTIONS, SALE_SOURCE_MARKETPLACE } from './constants';
import { LedgerService } from './ledger.service';
import { MarketplaceInventoryLedger } from './entities/marketplace-inventory-ledger.entity';
import { MarketplacePluginOptions } from './types';
import { marketplaceCustomFields } from './custom-fields';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceSellerService } from './marketplace-seller-service';
import { shopApiExtensions } from './api/api-extensions';
import { ShopResolver } from './api/shop.resolver';
import { multivendorShippingEligibilityChecker } from './config/mv-shipping-eligibility-checker';
import { MarketplaceSellerStrategy } from './marketplace-seller.strategy';
import { MarketplaceStockLocationStrategy } from './marketplace-stock.strategy';
import { marketplaceOrderProcess } from './marketplace-order-process';
import { paymentApiExtensions } from './payment/api-extensions';
import { DirectPaymentResolver } from './payment/direct-payment.resolver';
import { adminApiExtensions } from './api/admin.api-extensions';
import { AdminMarketplaceResolver } from './api/admin.resolver';
import { MerchantApiController } from './api/merchant-api.controller';
import { SettlementService } from './settlement.service';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [MarketplaceInventoryLedger],
    configuration: config => {
        config.customFields.Product = [
            ...(config.customFields.Product || []),
            ...marketplaceCustomFields.Product!,
        ];
        config.customFields.Order = [
            ...(config.customFields.Order || []),
            ...marketplaceCustomFields.Order!,
        ];
        config.customFields.Channel = [
            ...(config.customFields.Channel || []),
            ...marketplaceCustomFields.Channel!,
        ];
        config.customFields.Seller = [
            ...(config.customFields.Seller || []),
            ...marketplaceCustomFields.Seller!,
        ];
        config.shippingOptions.shippingEligibilityCheckers.push(multivendorShippingEligibilityChecker);

        const customDefaultOrderProcess = configureDefaultOrderProcess({ checkFulfillmentStates: false });
        config.orderOptions.process = [customDefaultOrderProcess, marketplaceOrderProcess];
        config.orderOptions.orderSellerStrategy = new MarketplaceSellerStrategy();
        config.catalogOptions.productVariantPriceUpdateStrategy =
            new DefaultProductVariantPriceUpdateStrategy({ syncPricesAcrossChannels: true });
        config.catalogOptions.stockLocationStrategy = new MarketplaceStockLocationStrategy();
        return config;
    },
    shopApiExtensions: {
        schema: (shopApiExtensions + paymentApiExtensions) as unknown as DocumentNode,
        resolvers: [ShopResolver, DirectPaymentResolver],
    },
    adminApiExtensions: {
        schema: adminApiExtensions as unknown as DocumentNode,
        resolvers: [AdminMarketplaceResolver],
    },
    providers: [
        MarketplaceService,
        MarketplaceSellerService,
        SettlementService,
        LedgerService,
        { provide: MARKETPLACE_PLUGIN_OPTIONS, useFactory: () => MarketplacePlugin.options },
    ],
    controllers: [MerchantApiController],
})
export class MarketplacePlugin implements OnApplicationBootstrap {
    static options: MarketplacePluginOptions;

    constructor(
        private eventBus: EventBus,
        private connection: TransactionalConnection,
        private entityHydrator: EntityHydrator,
        private ledgerService: LedgerService,
    ) {}

    static init(options: MarketplacePluginOptions) {
        MarketplacePlugin.options = options;
        return MarketplacePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async event => {
            const { order, ctx } = event;
            // 仅记录 marketplace 商家子单的销售
            if (order.customFields?.saleSource !== SALE_SOURCE_MARKETPLACE) {
                return;
            }
            const states = new Set(['Shipped', 'Fulfilled', 'Delivered', 'Completed']);
            if (!event.toState || !states.has(event.toState)) {
                return;
            }
            await this.entityHydrator.hydrate(ctx, order, {
                relations: ['lines', 'lines.productVariant', 'lines.productVariant.stockLevels', 'lines.sellerChannel'],
            });
            for (const line of order.lines) {
                const merchantChannelId = line.sellerChannelId
                    ? String(line.sellerChannelId)
                    : String(ctx.channelId);
                const stockOnHand = line.productVariant.stockLevels
                    ? line.productVariant.stockLevels.reduce<number>((sum, l) => sum + l.stockOnHand, 0)
                    : 0;
                await this.ledgerService.recordChange(ctx, {
                    variantId: line.productVariantId,
                    merchantChannelId,
                    saleSource: SALE_SOURCE_MARKETPLACE,
                    stockBefore: stockOnHand,
                    stockAfter: stockOnHand - line.quantity,
                    stockDelta: -line.quantity,
                    actionType: 'sale',
                    orderId: String(order.id),
                });
            }
        });

        // marketplace 商家子单退款时回补库存（actionType='refund'，stockDelta 为正）
        this.eventBus.ofType(RefundEvent).subscribe(async event => {
            const { order, refund, ctx } = event;
            // 仅处理 marketplace 商家子单的退款
            if (order.customFields?.saleSource !== SALE_SOURCE_MARKETPLACE) {
                return;
            }
            await this.entityHydrator.hydrate(ctx, refund, {
                relations: [
                    'lines',
                    'lines.orderLine',
                    'lines.orderLine.productVariant',
                    'lines.orderLine.productVariant.stockLevels',
                    'lines.orderLine.sellerChannel',
                ],
            });
            for (const line of refund.lines ?? []) {
                const orderLine = line.orderLine;
                if (!orderLine) {
                    continue;
                }
                const merchantChannelId = orderLine.sellerChannelId
                    ? String(orderLine.sellerChannelId)
                    : String(ctx.channelId);
                const stockOnHand = orderLine.productVariant?.stockLevels
                    ? orderLine.productVariant.stockLevels.reduce<number>((sum, l) => sum + l.stockOnHand, 0)
                    : 0;
                await this.ledgerService.recordChange(ctx, {
                    variantId: orderLine.productVariantId,
                    merchantChannelId,
                    saleSource: SALE_SOURCE_MARKETPLACE,
                    stockBefore: stockOnHand,
                    stockAfter: stockOnHand + line.quantity,
                    stockDelta: line.quantity,
                    actionType: 'refund',
                    orderId: String(order.id),
                });
            }
        });
    }
}