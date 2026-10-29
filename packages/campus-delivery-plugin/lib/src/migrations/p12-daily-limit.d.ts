import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/** Product.waimaiDailyLimit / waimaiPerUserLimit → 物理列（TypeORM 对 customFields 转小写） */
export declare const p12DailyLimitSql = "\nALTER TABLE product ADD COLUMN IF NOT EXISTS \"customFieldsWaimaidailylimit\" int;\nALTER TABLE product ADD COLUMN IF NOT EXISTS \"customFieldsWaimaiperuserlimit\" int;\n";
export declare class P12DailyLimitMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
