import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, CustomerService, Permission, RequestContext, UserInputError } from '@vendure/core';
import { DataSource } from 'typeorm';

/** 口味偏好 JSON 上限（字符）：与 C 端 normalizeProfile 输出量级持平，防止超大 payload */
const MAX_LEN = 2000;

/**
 * 口味偏好云端同步（P3-1）。
 * C 端原本只存本机（utils/taste-profile.ts），换设备即丢失；
 * 此处把同一份 JSON 落到 Customer.customFields.tasteProfile（物理列 customFieldsTasteprofile），
 * 登录后 C 端拉取覆盖本地，设置页保存时上行。结构校验在 C 端 normalizeProfile 完成，
 * 服务端只保证「合法 JSON 对象 + 长度上限」。
 */
@Resolver()
export class TasteProfileShopResolver {
    constructor(private customerService: CustomerService, private dataSource: DataSource) {}

    /** 读取本人云端口味偏好：未登录返回空串（C 端游客继续用本机存储） */
    @Query()
    @Allow(Permission.Authenticated)
    async campusMyTasteProfile(@Ctx() ctx: RequestContext): Promise<string> {
        const customerId = await this.requireCustomerId(ctx, false);
        if (!customerId) return '';
        const rows: Array<{ v: string | null }> = await this.dataSource.query(
            `SELECT "customFieldsTasteprofile" AS v FROM "customer" WHERE id = $1`,
            [customerId],
        );
        return rows[0]?.v ?? '';
    }

    /** 保存本人云端口味偏好：传空串代表清除 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async campusUpdateTasteProfile(
        @Ctx() ctx: RequestContext,
        @Args('input') input: string,
    ): Promise<string> {
        const customerId = await this.requireCustomerId(ctx, true);
        const raw = String(input ?? '').trim();
        if (raw.length > MAX_LEN) {
            throw new UserInputError('口味偏好数据过大（上限 2000 字符）');
        }
        if (raw) {
            let obj: any;
            try {
                obj = JSON.parse(raw);
            } catch {
                throw new UserInputError('口味偏好格式不合法');
            }
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
                throw new UserInputError('口味偏好格式不合法');
            }
        }
        await this.dataSource.query(
            `UPDATE "customer" SET "customFieldsTasteprofile" = $2 WHERE id = $1`,
            [customerId, raw || null],
        );
        return raw;
    }

    private async requireCustomerId(ctx: RequestContext, required: boolean): Promise<number | null> {
        if (!ctx.activeUserId) {
            if (required) throw new UserInputError('NOT_LOGGED_IN');
            return null;
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            if (required) throw new UserInputError('CUSTOMER_NOT_FOUND');
            return null;
        }
        return customer.id as unknown as number;
    }
}
