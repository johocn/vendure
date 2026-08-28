import { Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { WalletService } from './wallet.service';

@Resolver()
export class WalletShopResolver {
    constructor(private walletService: WalletService) {}

    /** 全局共享钱包余额（供前端判断可用余额）。 */
    @Query()
    @Allow(Permission.Public)
    async walletBalance(@Ctx() ctx: RequestContext): Promise<number> {
        const wallet = await this.walletService.get(ctx);
        return wallet.balance;
    }
}