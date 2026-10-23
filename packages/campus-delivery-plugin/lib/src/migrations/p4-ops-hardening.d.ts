import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p4OpsHardeningSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"timeoutCompensationWindowHours\" integer NOT NULL DEFAULT 24;\nALTER TABLE \"order\" ADD COLUMN IF NOT EXISTS \"customFieldsExceptionreportedat\" timestamp;\nALTER TABLE \"order\" ADD COLUMN IF NOT EXISTS \"customFieldsSlotlocked\" boolean DEFAULT false;\n-- \u65F6\u6BB5\u9501\u4F4D\u6807\u8BB0\u56DE\u586B\uFF1A\u5728\u9014\u9884\u7EA6\u5355\u89C6\u4E3A\u5DF2\u9501\u4F4D\uFF08\u5386\u53F2\u672A\u843D\u6807\u8BB0\uFF09\uFF0C\u907F\u514D\u5176\u53D6\u6D88\u65F6\u65E0\u6CD5\u5F52\u8FD8\u5BB9\u91CF\nUPDATE \"order\" SET \"customFieldsSlotlocked\" = true\nWHERE \"customFieldsDeliveryslotid\" IS NOT NULL\n  AND COALESCE(\"customFieldsSlotlocked\", false) = false\n  AND \"customFieldsHallstatus\" IN ('scheduled', 'pending_merchant', 'accepted', 'open', 'pending_dispatch', 'third_party', 'owned_pool', 'owned_dispatched', 'merchant_delivering', 'grabbed');\nUPDATE \"order\" SET \"customFieldsHallstatus\" = 'delivered'\nWHERE \"customFieldsDeliverystatus\" = 'delivered'\n  AND \"customFieldsHallstatus\" IS NOT NULL\n  AND \"customFieldsHallstatus\" NOT IN ('delivered', 'cancelled', 'no_rider_final', 'exception_final');\n";
export declare class P4OpsHardeningMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
