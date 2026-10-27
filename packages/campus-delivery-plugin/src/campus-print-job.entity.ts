import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

/** 云打印任务留痕（P1-4）：一单一任务，失败可在后台看原因并重打 */
@Entity()
export class CampusPrintJob extends VendureEntity {
    [key: string]: any;
    /** 关联订单（测试打印为 null） */
    @Column({ type: 'int', nullable: true }) orderId: ID | null;
    @Column({ type: 'int' }) channelId: ID;
    /** 打印通道：feie=飞鹅 / yilianyun=易联云 */
    @Column({ type: 'varchar', length: 16 }) provider: string;
    @Column({ type: 'varchar', length: 64, nullable: true }) deviceSn: string | null;
    /** ok / failed */
    @Column({ type: 'varchar', length: 16, default: 'pending' }) status: string;
    /** auto=自动出票 / manual=手动补打 / test=测试打印 */
    @Column({ type: 'varchar', length: 16 }) triggerType: string;
    @Column({ type: 'int', default: 1 }) copies: number;
    /** 服务商返回的「模拟」结果（未配置真实设备时不触达网络） */
    @Column({ default: false }) dryRun: boolean;
    @Column({ type: 'varchar', length: 500, nullable: true }) errorMessage: string | null;
    @Column({ type: 'int', nullable: true }) durationMs: number | null;
    /** 小票正文（排障/重发用） */
    @Column({ type: 'text', nullable: true }) content: string | null;
    constructor(input?: DeepPartial<CampusPrintJob>) {
        super(input);
    }
}
