import { OrderService, PaymentMethodHandler } from '@vendure/core';
import { RechargeCardService } from './recharge-card.service';
export declare function setRechargeService(service: RechargeCardService): void;
export declare function setOrderService(service: OrderService): void;
export declare const balancePaymentHandler: PaymentMethodHandler<{}>;
