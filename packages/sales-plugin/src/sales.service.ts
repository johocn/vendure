// e:\code\vendure\packages\sales-plugin\src\sales.service.ts
import { InputType, Field, ObjectType } from '@nestjs/graphql';
import { Injectable } from '@nestjs/common';
import {
  AdministratorService,
  CustomerService,
  ForbiddenError,
  ID,
  Logger,
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';

import { CustomerType, SalesChannel } from './constants';

const loggerCtx = 'SalesService';

@InputType()
export class SalesOrderLineInput {
  @Field() productVariantId: string;
  @Field() quantity: number;
  @Field({ nullable: true }) overwrittenPrice?: number;
}

@InputType()
export class NewCustomerInput {
  @Field() firstName: string;
  @Field() lastName: string;
  @Field({ nullable: true }) emailAddress?: string;
  @Field() phoneNumber: string;
  @Field() customerType: string;
  @Field({ nullable: true }) companyInfo?: any;
}

@InputType()
export class SalesCreateOrderInput {
  @Field({ nullable: true }) customerId?: string;
  @Field(() => NewCustomerInput, { nullable: true }) newCustomer?: NewCustomerInput;
  @Field(() => [SalesOrderLineInput]) lines: SalesOrderLineInput[];
  @Field() shippingAddress: any;
  @Field() shippingMethodId: string;
  @Field() salesChannel: string;
  @Field({ nullable: true }) note?: string;
}

@ObjectType()
export class SalesReportTopProduct {
  @Field() productVariantId: string;
  @Field() name: string;
  @Field() quantitySold: number;
  @Field() revenue: number;
}

@ObjectType()
export class SalesReportDaily {
  @Field() date: string;
  @Field() orderCount: number;
  @Field() revenue: number;
}

@ObjectType()
export class SalesReportResult {
  @Field() totalOrders: number;
  @Field() totalRevenue: number;
  @Field() uniqueCustomers: number;
  @Field() avgOrderValue: number;
  @Field(() => [SalesReportTopProduct]) topProducts: SalesReportTopProduct[];
  @Field(() => [SalesReportDaily]) dailyBreakdown: SalesReportDaily[];
}

@Injectable()
export class SalesService {
  constructor(
    private connection: TransactionalConnection,
    private orderService: OrderService,
    private customerService: CustomerService,
    private administratorService: AdministratorService,
  ) {}

  /**
   * 销售开单：单事务完成建客户+加商品行+设地址+设配送+写 salesStaffId
   */
  async createOrder(ctx: RequestContext, input: SalesCreateOrderInput): Promise<Order> {
    if (!ctx.activeUserId) {
      throw new ForbiddenError();
    }

    return this.connection.withTransaction(ctx, async txCtx => {
      // 1. 解析 customerId
      let customerId = input.customerId;
      if (!customerId && input.newCustomer) {
        const nc = input.newCustomer;
        // emailAddress 占位策略
        const emailAddress = nc.emailAddress || `${nc.phoneNumber}@placeholder.local`;
        const created = await this.customerService.create(txCtx, {
          firstName: nc.firstName,
          lastName: nc.lastName,
          emailAddress,
          phoneNumber: nc.phoneNumber,
          customFields: {
            customerType: nc.customerType,
            companyInfo: nc.companyInfo,
            salesStaffId: String(ctx.activeUserId),
            customerTags: [],
          },
        });
        if ('errorCode' in created) {
          throw new UserInputError(created.message ?? created.errorCode);
        }
        customerId = String(created.id);
      }
      if (!customerId) {
        throw new UserInputError('Either customerId or newCustomer must be provided');
      }

      // 2. 查 customer 拿 userId
      const customer = await this.customerService.findOne(txCtx, customerId as any, ['user']);
      if (!customer || !customer.user) {
        throw new UserInputError(`Customer ${customerId} not found or has no user`);
      }

      // 3. 创建 Order
      const order = await this.orderService.create(txCtx, customer.user.id);

      // 4. 加商品行（含 overwrittenPrice）
      const items = input.lines.map(line => ({
        productVariantId: line.productVariantId,
        quantity: line.quantity,
        customFields: line.overwrittenPrice
          ? {
              overwrittenPrice: line.overwrittenPrice,
              originalPrice: null,
              modifiedBy: String(ctx.activeUserId),
              modifiedAt: new Date(),
            }
          : {},
      }));
      const addResult = await this.orderService.addItemsToOrder(txCtx, order.id, items as any);
      if (addResult.errorResults?.length) {
        throw new UserInputError(addResult.errorResults[0].message ?? 'Add items failed');
      }
      let updatedOrder = addResult.order;

      // 5. 设地址
      updatedOrder = await this.orderService.setShippingAddress(
        txCtx,
        updatedOrder.id,
        input.shippingAddress,
      );

      // 6. 设配送方式
      const shippingResult = await this.orderService.setShippingMethod(
        txCtx,
        updatedOrder.id,
        [input.shippingMethodId as any],
      );
      if ('errorCode' in shippingResult) {
        throw new UserInputError(shippingResult.message ?? 'Set shipping method failed');
      }
      updatedOrder = shippingResult;

      // 7. 写 Order customFields
      updatedOrder = await this.orderService.updateCustomFields(
        txCtx,
        updatedOrder.id,
        {
          salesStaffId: String(ctx.activeUserId),
          salesChannel: input.salesChannel,
          salesNote: input.note ?? null,
        },
      );

      Logger.info(
        `Sales order created: ${updatedOrder.code} by user ${ctx.activeUserId}`,
        loggerCtx,
      );
      return updatedOrder;
    });
  }

  /**
   * 查询我的销售单（按 salesStaffId 过滤）
   */
  async findMySales(
    ctx: RequestContext,
    options?: { page?: number; pageSize?: number; state?: string },
  ): Promise<{ items: Order[]; totalItems: number }> {
    if (!ctx.activeUserId) {
      return { items: [], totalItems: 0 };
    }
    const qb = this.connection
      .getRepository(ctx, Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.lines', 'lines')
      .where('order.customFields.salesStaffId = :staffId', { staffId: String(ctx.activeUserId) })
      .andWhere('(order.active = :active OR order.state IN (:...cancelledStates))', {
        active: true,
        cancelledStates: ['Cancelled', 'Completed'],
      });

    if (options?.state) {
      qb.andWhere('order.state = :state', { state: options.state });
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize).orderBy('order.createdAt', 'DESC');

    const [items, totalItems] = await qb.getManyAndCount();
    return { items, totalItems };
  }

  /**
   * 查询全部销售单（manager+）
   */
  async findAllSales(
    ctx: RequestContext,
    options?: { page?: number; pageSize?: number; state?: string; staffId?: string },
  ): Promise<{ items: Order[]; totalItems: number }> {
    const qb = this.connection
      .getRepository(ctx, Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.customFields.salesStaffId IS NOT NULL')
      .andWhere('(order.active = :active OR order.state IN (:...cancelledStates))', {
        active: true,
        cancelledStates: ['Cancelled', 'Completed'],
      });

    if (options?.state) {
      qb.andWhere('order.state = :state', { state: options.state });
    }
    if (options?.staffId) {
      qb.andWhere('order.customFields.salesStaffId = :staffId', { staffId: options.staffId });
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize).orderBy('order.createdAt', 'DESC');

    const [items, totalItems] = await qb.getManyAndCount();
    return { items, totalItems };
  }

  /**
   * 修改订单行价格
   */
  async modifyOrderLinePrice(
    ctx: RequestContext,
    orderLineId: ID,
    newPrice: number,
  ): Promise<Order> {
    if (!ctx.activeUserId) {
      throw new ForbiddenError();
    }
    const orderLineRepo = this.connection.getRepository(ctx, 'OrderLine' as any);
    const orderLine = await orderLineRepo.findOne({
      where: { id: orderLineId as any },
      relations: ['order'],
    });
    if (!orderLine || !orderLine.order) {
      throw new UserInputError(`OrderLine ${orderLineId} not found`);
    }
    const order = orderLine.order;

    await this.connection
      .getRepository(ctx, 'OrderLine' as any)
      .update({ id: orderLineId as any }, {
        customFields: {
          overwrittenPrice: newPrice,
          originalPrice: orderLine.productVariant?.listPrice ?? null,
          modifiedBy: String(ctx.activeUserId),
          modifiedAt: new Date(),
        },
      } as any);

    const updatedOrder = await this.orderService.adjustOrderLine(
      ctx,
      order.id,
      orderLineId,
      orderLine.quantity,
      { overwrittenPrice: newPrice, modifiedBy: String(ctx.activeUserId), modifiedAt: new Date() },
    );
    if ('errorCode' in updatedOrder) {
      throw new UserInputError(updatedOrder.message ?? 'Adjust order line failed');
    }
    return updatedOrder;
  }

  /**
   * 取消订单（仅 AddingItems 状态）
   */
  async cancelOrder(ctx: RequestContext, orderId: ID, reason?: string): Promise<Order> {
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
      throw new UserInputError(`Order ${orderId} not found`);
    }
    if (order.state !== 'AddingItems') {
      throw new UserInputError(`Order state ${order.state} cannot be cancelled`);
    }
    const result = await this.orderService.transitionToState(ctx, orderId, 'Cancelled');
    if ('errorCode' in result) {
      throw new UserInputError(result.message ?? 'Cancel failed');
    }
    return result;
  }

  /**
   * 生成业绩报表
   */
  async buildReport(
    ctx: RequestContext,
    staffId: string | undefined,
    range: { start: Date; end: Date },
  ): Promise<SalesReportResult> {
    const qb = this.connection
      .getRepository(ctx, Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.lines', 'lines')
      .leftJoinAndSelect('lines.productVariant', 'variant')
      .where('order.customFields.salesStaffId IS NOT NULL')
      .andWhere('order.createdAt BETWEEN :start AND :end', {
        start: range.start,
        end: range.end,
      });

    if (staffId) {
      qb.andWhere('order.customFields.salesStaffId = :staffId', { staffId });
    }

    const orders = await qb.getMany();

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const customerIds = new Set(orders.map(o => o.customer?.id).filter(Boolean));
    const uniqueCustomers = customerIds.size;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const productMap = new Map<string, { name: string; quantitySold: number; revenue: number }>();
    for (const o of orders) {
      for (const line of o.lines ?? []) {
        const variantId = String(line.productVariant?.id ?? '');
        const name = line.productVariant?.name ?? 'Unknown';
        const quantitySold = line.quantity;
        const revenue = (line.unitPrice ?? 0) * line.quantity;
        const existing = productMap.get(variantId) ?? { name, quantitySold: 0, revenue: 0 };
        existing.quantitySold += quantitySold;
        existing.revenue += revenue;
        productMap.set(variantId, existing);
      }
    }
    const topProducts = Array.from(productMap.entries())
      .map(([productVariantId, v]) => ({ productVariantId, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const dailyMap = new Map<string, { orderCount: number; revenue: number }>();
    for (const o of orders) {
      const date = (o.createdAt as Date).toISOString().slice(0, 10);
      const existing = dailyMap.get(date) ?? { orderCount: 0, revenue: 0 };
      existing.orderCount++;
      existing.revenue += o.total ?? 0;
      dailyMap.set(date, existing);
    }
    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalOrders,
      totalRevenue,
      uniqueCustomers,
      avgOrderValue,
      topProducts,
      dailyBreakdown,
    };
  }
}
