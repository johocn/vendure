import { RequestContext } from '@vendure/core';
import { WalletService } from './wallet.service';
export declare class WalletShopResolver {
    private walletService;
    constructor(walletService: WalletService);
    /** 全局共享钱包余额（供前端判断可用余额）。 */
    walletBalance(ctx: RequestContext): Promise<number>;
}
