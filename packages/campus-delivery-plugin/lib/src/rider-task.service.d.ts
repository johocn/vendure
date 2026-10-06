import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusNotifyService } from './campus-notify.service';
import { HallService } from './hall.service';
import { RiderCreditService } from './rider-credit.service';
import { RiderService } from './rider.service';
export declare class RiderTaskService {
    private connection;
    private riderService;
    private credit;
    private hall;
    private notify;
    constructor(connection: TransactionalConnection, riderService: RiderService, credit: RiderCreditService, hall: HallService, notify: CampusNotifyService);
    /** 订单骑手卡信息：C 端订单跟踪轮询用。未指派返回 null。 */
    orderRider(ctx: RequestContext, orderId: ID): Promise<{
        realName: any;
        credit: any;
    } | null>;
    /** 我的任务：本骑手名下已进入配送流程的订单，按下单时间倒序。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径 order.customFields.deliveryStaffId
     * （与 delivery-plugin 写法一致），裸列 order.deliveryStaffId 在 PG 不存在。
     * 渠道过滤：Order 无标量 channelId，join order.channels 过滤 channel.id（同 hall()）。 */
    myTasks(ctx: RequestContext, status?: string): Promise<Order[]>;
    /** 转单回大厅：assigned 未取货直接回；in_progress 已取货必须拍照交接存证。
     * 回大厅复用 backToHall（清骑手指派、hallStatus 复位 open），存证写 transferPhotos。
     * 一期转单不扣信用分（规则后续租户可配）。 */
    transfer(ctx: RequestContext, orderId: ID, photos: string[], note?: string): Promise<Order>;
    /** 开始配送：assigned → in_progress */
    start(ctx: RequestContext, orderId: ID): Promise<Order>;
    /** 送达：拍照必传 → delivered → 分成入余额（0 分成单跳过入账） */
    deliver(ctx: RequestContext, orderId: ID, photos: string[], note?: string): Promise<Order>;
    /** 异常上报：不校验状态，标记 exception */
    reportException(ctx: RequestContext, orderId: ID, type: string, photos: string[], note?: string): Promise<Order>;
    private calcEarning;
    private getConfig;
    private assertOwner;
}
