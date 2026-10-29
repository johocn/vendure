import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/** 履约配置 4 个自动接单字段（simple-json 路线列存 text）+ Order.autoAcceptedAt 留痕列 */
export declare const p13AutoAcceptSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"autoAcceptEnabled\" boolean NOT NULL DEFAULT false;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"autoAcceptDelaySeconds\" int NOT NULL DEFAULT 30;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"autoAcceptDailyLimit\" int NOT NULL DEFAULT 0;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"autoAcceptRoutes\" text NOT NULL DEFAULT '[\"R1\",\"R2\",\"R3\"]';\nALTER TABLE \"order\" ADD COLUMN IF NOT EXISTS \"customFieldsAutoacceptedat\" timestamp;\n";
export declare class P13AutoAcceptMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
