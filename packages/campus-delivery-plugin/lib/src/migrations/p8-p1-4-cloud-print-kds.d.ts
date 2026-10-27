import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/** 店铺级打印通道配置（campus_fulfillment_config） */
export declare const p8P1_4ConfigSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"printProvider\" varchar(16) NOT NULL DEFAULT 'local';\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"printAccount\" varchar(64);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"printDeviceSn\" varchar(64);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"printDeviceKey\" varchar(128);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"printCopies\" int NOT NULL DEFAULT 1;\n";
/** 打印任务留痕：每次云打印（含测试打印）落一条，排障/重打依据 */
export declare const p8P1_4PrintJobSql = "\nCREATE TABLE IF NOT EXISTS campus_print_job (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  \"orderId\" int, \"channelId\" int NOT NULL, provider varchar(16) NOT NULL, \"deviceSn\" varchar(64),\n  status varchar(16) NOT NULL DEFAULT 'pending', \"triggerType\" varchar(16) NOT NULL,\n  copies int NOT NULL DEFAULT 1, \"dryRun\" boolean NOT NULL DEFAULT false,\n  \"errorMessage\" varchar(500), \"durationMs\" int, content text);\nCREATE INDEX IF NOT EXISTS \"IDX_campus_print_job_channel_created\"\n  ON campus_print_job (\"channelId\", \"createdAt\" DESC);\n";
export declare class P8P1_4CloudPrintMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
