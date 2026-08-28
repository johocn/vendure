import { RequestContext } from '@vendure/core';
import { Wallet } from './wallet.entity';
import { WalletService } from './wallet.service';
export declare class WalletAdminResolver {
    private walletService;
    constructor(walletService: WalletService);
    wallet(ctx: RequestContext): Promise<Wallet>;
    adminCreditWallet(ctx: RequestContext, amount: number): Promise<Wallet>;
    adminDebitWallet(ctx: RequestContext, amount: number): Promise<Wallet>;
}
