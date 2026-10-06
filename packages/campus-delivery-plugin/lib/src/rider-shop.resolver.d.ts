import { ID, RequestContext } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { CampusConfigService } from './campus-config.service';
import { RiderService } from './rider.service';
import { RiderWalletService } from './rider-wallet.service';
export declare class RiderShopResolver {
    private riderService;
    private configService;
    private capacity;
    private wallet;
    constructor(riderService: RiderService, configService: CampusConfigService, capacity: CapacityService, wallet: RiderWalletService);
    /** 需登录：service 内部校验当前顾客，未登录抛 ForbiddenError。 */
    applyRider(ctx: RequestContext, realName: string, studentNo: string, campus: string, idImg?: string): Promise<{
        status: string;
    }>;
    myRiderProfile(ctx: RequestContext): Promise<{
        customerId: ID;
        riderStatus: any;
        riderRealName: any;
        riderStudentNo: any;
        riderCampus: any;
        riderCredit: any;
    }>;
    /** 骑手钱包：可用余额 / 冻结中 / 累计收入 */
    myRiderWallet(ctx: RequestContext): Promise<{
        available: number;
        frozen: number;
        totalEarned: number;
    }>;
    /** 余额流水（含分成入账/充值/消费/提现冻结/退回） */
    riderBalanceHistory(ctx: RequestContext, skip?: number, take?: number): Promise<import("@vendure/recharge-card-plugin").BalanceTransaction[]>;
    /** 本人提现申请记录 */
    riderWithdrawRequests(ctx: RequestContext, skip?: number, take?: number): Promise<import("./rider-withdrawal.entity").RiderWithdrawalRequest[]>;
    /** 提现申请：金额（分）+ 收款渠道 + 账号，提交即冻结 */
    riderWithdraw(ctx: RequestContext, amount: number, channel: string, account: string): Promise<any>;
    /** 骑手上下线开关（大厅轮询页 15s 轮询续命） */
    campusRiderOnline(ctx: RequestContext, online: boolean): Promise<{
        online: boolean;
    }>;
    /** 骑手心跳（30s 定时调），带骑手资格校验 */
    campusRiderHeartbeat(ctx: RequestContext): Promise<{
        online: boolean;
    }>;
    /** T0 运力预检：C 端下单前提示「运力紧张」 */
    campusCapacityCheck(ctx: RequestContext): Promise<{
        paused: boolean;
        ridersOnline: number;
    }>;
    campusZones(ctx: RequestContext): Promise<import("./campus-zone.entity").CampusZone[]>;
    campusBuildings(ctx: RequestContext, zoneId?: ID): Promise<import("./campus-building.entity").CampusBuilding[]>;
}
