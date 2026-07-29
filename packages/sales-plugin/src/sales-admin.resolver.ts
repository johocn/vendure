// e:\code\vendure\packages\sales-plugin\src\sales-admin.resolver.ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  AdministratorService,
  Ctx,
  ForbiddenError,
  ID,
  Order,
  Permission,
  RequestContext,
} from '@vendure/core';
import { SUPER_ADMIN_ROLE_CODE } from '@vendure/common/lib/shared-constants';

import { SalesPermissions } from './constants';
import { SalesService, SalesCreateOrderInput, SalesReportResult } from './sales.service';

@Resolver()
export class SalesAdminResolver {
  constructor(
    private salesService: SalesService,
    private administratorService: AdministratorService,
  ) {}

  /**
   * 销售员判断是否为 manager+（可查全部）
   */
  private async isManager(ctx: RequestContext): Promise<boolean> {
    if (!ctx.activeUserId) return false;
    const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId, [
      'user',
      'user.roles',
    ]);
    const roles = admin?.user?.roles?.map(r => r.code) ?? [];
    return (
      roles.includes('manager') ||
      roles.includes('super-admin') ||
      roles.includes(SUPER_ADMIN_ROLE_CODE) ||
      (admin?.user?.roles ?? []).some(r => r.permissions?.includes(Permission.SuperAdmin))
    );
  }

  @Query(() => [Order])
  @Allow(SalesPermissions.ViewOwnSales as Permission)
  async mySales(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
    @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
    @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
  ) {
    const result = await this.salesService.findMySales(ctx, { state, page, pageSize });
    return result.items;
  }

  @Query(() => [Order])
  @Allow(SalesPermissions.ViewAllSales as Permission)
  async allSales(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
    @Args({ name: 'staffId', type: () => String, nullable: true }) staffId?: string,
    @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
    @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
  ) {
    const result = await this.salesService.findAllSales(ctx, { state, staffId, page, pageSize });
    return result.items;
  }

  @Query(() => Order, { nullable: true })
  @Allow(SalesPermissions.ViewOwnSales as Permission)
  async salesOrder(
    @Ctx() ctx: RequestContext,
    @Args('id') id: ID,
  ) {
    const result = await this.salesService.findMySales(ctx);
    return result.items.find(o => String(o.id) === String(id)) ?? null;
  }

  @Mutation(() => Order)
  @Allow(SalesPermissions.CreateOrder as Permission)
  async salesCreateOrder(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'input', type: () => SalesCreateOrderInput }) input: SalesCreateOrderInput,
  ) {
    return this.salesService.createOrder(ctx, input);
  }

  @Mutation(() => Order)
  @Allow(SalesPermissions.ModifyOrderPrice as Permission)
  async modifyOrderLinePrice(
    @Ctx() ctx: RequestContext,
    @Args('orderLineId') orderLineId: ID,
    @Args({ name: 'newPrice', type: () => Number }) newPrice: number,
  ) {
    return this.salesService.modifyOrderLinePrice(ctx, orderLineId, newPrice);
  }

  @Mutation(() => Order)
  @Allow(SalesPermissions.CreateOrder as Permission)
  async cancelSalesOrder(
    @Ctx() ctx: RequestContext,
    @Args('orderId') orderId: ID,
    @Args({ name: 'reason', type: () => String, nullable: true }) reason?: string,
  ) {
    return this.salesService.cancelOrder(ctx, orderId, reason);
  }

  @Query(() => SalesReportResult)
  @Allow(SalesPermissions.ViewSalesReport as Permission)
  async mySalesReport(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'start', type: () => String }) start: string,
    @Args({ name: 'end', type: () => String }) end: string,
  ) {
    if (!ctx.activeUserId) return this.salesService.buildReport(ctx, undefined, { start: new Date(start), end: new Date(end) });
    return this.salesService.buildReport(ctx, String(ctx.activeUserId), {
      start: new Date(start),
      end: new Date(end),
    });
  }

  @Query(() => SalesReportResult)
  @Allow(SalesPermissions.ViewSalesReport as Permission)
  async salesReport(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'start', type: () => String }) start: string,
    @Args({ name: 'end', type: () => String }) end: string,
    @Args({ name: 'staffId', type: () => String, nullable: true }) staffId?: string,
  ) {
    const isManager = await this.isManager(ctx);
    const targetStaffId = isManager ? staffId : String(ctx.activeUserId);
    if (!isManager && staffId && staffId !== String(ctx.activeUserId)) {
      throw new ForbiddenError();
    }
    return this.salesService.buildReport(ctx, targetStaffId, {
      start: new Date(start),
      end: new Date(end),
    });
  }
}
