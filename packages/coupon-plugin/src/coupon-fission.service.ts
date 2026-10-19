import { Injectable } from '@nestjs/common';
import { Customer, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';

import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { CouponFissionRecord } from './coupon-fission-record.entity';
import {
    CouponFissionConfig,
    CouponFissionView,
    parseCouponFissionConfig,
    parseReversibleInviteCode,
    resolveActiveFission,
} from './coupon-fission';
import { loggerCtx } from './constants';

/**
 * 分享裂变（FR-C）服务：
 * - fissionActivity：匿名可查活动视图（含奖励券模板摘要）
 * - claimReward：登录后领取裂变奖励（幂等 + 四例外 + 事务化，R1/R2/R3）
 */
@Injectable()
export class CouponFissionService {
    constructor(
        private connection: TransactionalConnection,
        private couponService: CouponService,
    ) {}

    /** 渠道 couponFission 配置原文 */
    private async loadRawConfig(ctx: RequestContext): Promise<unknown> {
        const channel = await this.connection
            .getRepository(ctx, 'Channel' as any)
            .createQueryBuilder('ch')
            .where('ch.id = :id', { id: ctx.channelId })
            .getOne();
        return (channel as any)?.customFields?.couponFission ?? null;
    }

    /** 活动视图（匿名可查）：返回 null 表示无生效活动（前端不渲染/落页仅展示券店）。 */
    async fissionActivity(ctx: RequestContext): Promise<CouponFissionView<CouponTemplate> | null> {
        const raw = await this.loadRawConfig(ctx);
        const cfg = parseCouponFissionConfig(raw);
        if (!cfg) return null;
        const templateIds = [cfg.inviteeTemplateId, cfg.inviterTemplateId].filter(n => n > 0);
        if (templateIds.length === 0) return null;
        const templates = await this.connection.getRepository(ctx, CouponTemplate).find({
            where: { id: In(templateIds) as any },
            relations: { channels: true },
        });
        const own = templates.filter(t => t.enabled && (t.channels ?? []).some(c => c.id === ctx.channelId));
        const view = resolveActiveFission(raw, own, new Date(), ctx.languageCode);
        if (!view) return null;
        // 奖励券剩余量（R2 口径）： totalCount>0 && claimedCount>=totalCount → 该侧奖励标记售罄（不发券但活动可继续展示，由前端渲染「已领完」）
        return view;
    }

    /**
     * 领取裂变奖励（登录用户，以邀请码定位分享者）。
     * 返回 status：
     * - OK：发券成功（双方或单方，看 inviterCoupon）
     * - ALREADY_REWARDED：同被分享者同活动已领过（幂等，R3）
     * - SELF_SHARE：自分享不发奖
     * - BLOCKED_NEW_CUSTOMER：活动限新客且被分享者非新客（记档不再重试）
     * - SOLD_OUT：奖励券余量耗尽（R2，可重试但通常稳定失败）
     * - NOT_LOGGED_IN / NO_INVITER / INACTIVE：登录/邀请码/活动窗口问题（服务端已兜底，前端仍需各自引导）
     */
    async claimReward(
        ctx: RequestContext,
        inviteCode: string,
    ): Promise<{
        status: string;
        inviteeCoupon: CustomerCoupon | null;
        inviterCoupon: CustomerCoupon | null;
    }> {
        const customerId = ctx.activeUserId
            ? ((await this.connection
                  .getRepository(ctx, Customer)
                  .findOne({ where: { user: { id: ctx.activeUserId } } }))?.id as number | undefined)
            : undefined;
        if (!customerId) {
            return { status: 'NOT_LOGGED_IN', inviteeCoupon: null, inviterCoupon: null };
        }
        // 领券前收敛过期券（与限领/计数语义一致）
        await this.couponService.expireDueCoupons(ctx, customerId);

        const raw = await this.loadRawConfig(ctx);
        const templatesRepo = this.connection.getRepository(ctx, CouponTemplate);
        const cfg = parseCouponFissionConfig(raw);
        if (!cfg) {
            return { status: 'INACTIVE', inviteeCoupon: null, inviterCoupon: null };
        }
        const templateIds = [cfg.inviteeTemplateId, cfg.inviterTemplateId].filter(n => n > 0);
        const templates = templateIds.length
            ? await templatesRepo.find({ where: { id: In(templateIds) as any }, relations: { channels: true } })
            : [];
        const own = templates.filter(t => t.enabled && (t.channels ?? []).some(c => c.id === ctx.channelId));
        const activity = resolveActiveFission(raw, own, new Date(), ctx.languageCode);
        if (!activity) {
            return { status: 'INACTIVE', inviteeCoupon: null, inviterCoupon: null };
        }

        // 定位分享者：优先可逆码 F<base36(customerId)>（FR-C 分享链标准形态，每人固定、无快照歧义）；
        // 非 F 前缀回退 Customer.customFields.inviteCode 反查（SSO 邀请快照，兼容旧链路）。
        const code = String(inviteCode ?? '').trim();
        if (!code) {
            return { status: 'NO_INVITER', inviteeCoupon: null, inviterCoupon: null };
        }
        let inviter: Customer | undefined;
        const reversibleId = parseReversibleInviteCode(code);
        if (reversibleId != null) {
            inviter =
                (await this.connection
                    .getRepository(ctx, Customer)
                    .findOne({ where: { id: reversibleId }, relations: { channels: true } })) ?? undefined;
            if (inviter && !(inviter.channels ?? []).some(ch => ch.id === ctx.channelId)) {
                inviter = undefined; // 分享者不属于本租户：按无效码处理
            }
        } else {
            const isPg = this.connection.rawConnection.options.type === 'postgres';
            if (isPg) {
                inviter =
                    (await this.connection
                        .getRepository(ctx, Customer)
                        .createQueryBuilder('c')
                        .innerJoin('c.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId })
                        .where('c.customFields.inviteCode = :code', { code })
                        .getOne()) ?? undefined;
            } else {
                // e2e（SQLite）：数据量小，全量过滤
                const all = await this.connection.getRepository(ctx, Customer).find({ relations: { channels: true } });
                inviter = all.find(
                    c =>
                        (c.customFields as any)?.inviteCode === code &&
                        (c.channels ?? []).some(ch => ch.id === ctx.channelId),
                );
            }
        }
        if (!inviter?.id) {
            return { status: 'NO_INVITER', inviteeCoupon: null, inviterCoupon: null };
        }
        const inviterId = inviter.id as number;
        if (inviterId === customerId) {
            return { status: 'SELF_SHARE', inviteeCoupon: null, inviterCoupon: null };
        }

        const recordRepo = this.connection.getRepository(ctx, CouponFissionRecord);
        const existing = await recordRepo.findOne({
            where: { channelId: ctx.channelId as number, inviteeCustomerId: customerId } as any,
        });
        if (existing) {
            const [inviteeCoupon, inviterCoupon] = await Promise.all([
                existing.inviteeCouponId
                    ? this.connection.getRepository(ctx, CustomerCoupon).findOne({ where: { id: existing.inviteeCouponId as any } })
                    : null,
                existing.inviterCouponId
                    ? this.connection.getRepository(ctx, CustomerCoupon).findOne({ where: { id: existing.inviterCouponId as any } })
                    : null,
            ]);
            if (existing.status === 'BLOCKED_NEW_CUSTOMER') {
                return { status: 'BLOCKED_NEW_CUSTOMER', inviteeCoupon: null, inviterCoupon: null };
            }
            return { status: 'ALREADY_REWARDED', inviteeCoupon: inviteeCoupon ?? null, inviterCoupon: inviterCoupon ?? null };
        }

        // 事务化发奖（R3）：扣量 → 建券（双方）→ 落记录（唯一索引兜底幂等），任一步失败整体回滚
        try {
            return await this.connection.withTransaction(ctx, async txCtx =>
                this.claimRewardInTransaction(txCtx, { cfg, activity, inviterId, customerId }),
            );
        } catch (e: any) {
            if (String(e?.message ?? '').includes('UNIQUE') || String(e?.code ?? '') === '23505') {
                // 并发下唯一索引冲突 = 同被分享者同活动已领过（R3 幂等）
                Logger.warn(`fission record conflict for customer ${customerId}: ${e?.message ?? e}`, loggerCtx);
                return { status: 'ALREADY_REWARDED', inviteeCoupon: null, inviterCoupon: null };
            }
            throw e;
        }
    }

    /** 事务内执行发奖主体（withTransaction 回调；所有读写必须走传入的 txCtx）。 */
    private async claimRewardInTransaction(
        txCtx: RequestContext,
        input: {
            cfg: CouponFissionConfig;
            activity: CouponFissionView<CouponTemplate>;
            inviterId: number;
            customerId: number;
        },
    ): Promise<{ status: string; inviteeCoupon: CustomerCoupon | null; inviterCoupon: CustomerCoupon | null }> {
        const { cfg, activity, inviterId, customerId } = input;
        const recordRepo = this.connection.getRepository(txCtx, CouponFissionRecord);
        // 事务内复检（并发窗口兜底）
        const existingInTx = await recordRepo.findOne({
            where: { channelId: txCtx.channelId as number, inviteeCustomerId: customerId } as any,
        });
        if (existingInTx) {
            return await this.mapExisting(existingInTx, txCtx);
        }
        if (cfg.newCustomerOnly && !(await this.couponService.isCampaignNewCustomer(txCtx, customerId))) {
            await recordRepo.save(
                new CouponFissionRecord({
                    channelId: txCtx.channelId as number,
                    inviterCustomerId: inviterId,
                    inviteeCustomerId: customerId,
                    inviteeCouponId: null,
                    inviterCouponId: null,
                    status: 'BLOCKED_NEW_CUSTOMER',
                    sharedAt: new Date(),
                } as any),
            );
            return { status: 'BLOCKED_NEW_CUSTOMER', inviteeCoupon: null, inviterCoupon: null };
        }
        const inviteeCoupon = await this.issueRewardInTx(txCtx, customerId, activity.inviteeTemplate);
        if (!inviteeCoupon) {
            return { status: 'SOLD_OUT', inviteeCoupon: null, inviterCoupon: null };
        }
        let inviterCoupon: CustomerCoupon | null = null;
        if (activity.inviterTemplate) {
            const limit = cfg.inviterRewardLimit;
            if (limit > 0) {
                const rewarded = await recordRepo
                    .createQueryBuilder('r')
                    .where('r.channelId = :channelId', { channelId: txCtx.channelId })
                    .andWhere('r.inviterCustomerId = :inviterId', { inviterId })
                    .andWhere('r.inviterCouponId IS NOT NULL')
                    .getCount();
                if (rewarded >= limit) {
                    Logger.info(
                        `fission: inviter ${inviterId} reached reward limit ${limit}, skip inviter coupon`,
                        loggerCtx,
                    );
                } else if (activity.inviterTemplate) {
                    inviterCoupon = await this.issueRewardInTx(txCtx, inviterId, activity.inviterTemplate);
                }
            } else if (activity.inviterTemplate) {
                inviterCoupon = await this.issueRewardInTx(txCtx, inviterId, activity.inviterTemplate);
            }
        }
        await recordRepo.save(
            new CouponFissionRecord({
                channelId: txCtx.channelId as number,
                inviterCustomerId: inviterId,
                inviteeCustomerId: customerId,
                inviteeCouponId: inviteeCoupon?.id ?? null,
                inviterCouponId: inviterCoupon?.id ?? null,
                status: 'OK',
                sharedAt: new Date(),
            } as any),
        );
        Logger.info(
            `fission rewarded: invitee=${customerId} inviter=${inviterId} inviteeCoupon=${inviteeCoupon?.code ?? '-'} inviterCoupon=${inviterCoupon?.code ?? '-'}`,
            loggerCtx,
        );
        return { status: 'OK', inviteeCoupon, inviterCoupon };
    }

    /** 已有记录 → 结果映射（幂等重入） */
    private async mapExisting(
        record: CouponFissionRecord,
        ctx: RequestContext,
    ): Promise<{ status: string; inviteeCoupon: CustomerCoupon | null; inviterCoupon: CustomerCoupon | null }> {
        if (record.status === 'BLOCKED_NEW_CUSTOMER') {
            return { status: 'BLOCKED_NEW_CUSTOMER', inviteeCoupon: null, inviterCoupon: null };
        }
        const ccRepo = this.connection.getRepository(ctx, CustomerCoupon);
        const [inviteeCoupon, inviterCoupon] = await Promise.all([
            record.inviteeCouponId
                ? ccRepo.findOne({ where: { id: record.inviteeCouponId as any } })
                : Promise.resolve(null),
            record.inviterCouponId
                ? ccRepo.findOne({ where: { id: record.inviterCouponId as any } })
                : Promise.resolve(null),
        ]);
        return { status: 'ALREADY_REWARDED', inviteeCoupon: inviteeCoupon ?? null, inviterCoupon: inviterCoupon ?? null };
    }

    /** 发放单侧奖励：原子扣发行余量 + 建券（issuedBy=FISSION 留痕）。售罄/失败返回 null（事务内不产生半写）。 */
    private async issueRewardInTx(
        ctx: RequestContext,
        customerId: number,
        tpl: CouponTemplate,
    ): Promise<CustomerCoupon | null> {
        try {
            return await this.couponService.issueForProgram(ctx, customerId, tpl, 'FISSION');
        } catch (e: any) {
            Logger.warn(`fission issue failed for customer ${customerId}: ${e?.message ?? e}`, loggerCtx);
            return null;
        }
    }

    /** 裂变记录列表（管理端核对渠道留痕，R1） */
    async listFissionRecords(ctx: RequestContext, take = 50): Promise<CouponFissionRecord[]> {
        return this.connection
            .getRepository(ctx, CouponFissionRecord)
            .createQueryBuilder('r')
            .where('r.channelId = :channelId', { channelId: ctx.channelId })
            .orderBy('r.id', 'DESC')
            .take(take)
            .getMany();
    }
}
