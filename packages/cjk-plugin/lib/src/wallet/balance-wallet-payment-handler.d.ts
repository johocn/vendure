import { PaymentMethodHandler } from '@vendure/core';
import { WalletService } from './wallet.service';
export declare function setWalletService(service: WalletService): void;
export declare const balanceWalletPaymentHandler: PaymentMethodHandler<{}>;
