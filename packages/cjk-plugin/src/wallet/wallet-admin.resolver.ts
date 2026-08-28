import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { Wallet } from './wallet.entity';
import { WalletService } from './wallet.service';

@Resolver()
export class WalletAdminResolver {
    constructor(private walletService: WalletService) {}

    @Query()
    @Allow(Permission.SuperAdmin)
    async wallet(@Ctx() ctx: RequestContext): Promise<Wallet> {
        return this.walletService.get(ctx);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async adminCreditWallet(@Ctx() ctx: RequestContext, @Args('amount') amount: number): Promise<Wallet> {
        return this.walletService.credit(ctx, amount);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async adminDebitWallet(@Ctx() ctx: RequestContext, @Args('amount') amount: number): Promise<Wallet> {
        return this.walletService.debit(ctx, amount);
    }
}