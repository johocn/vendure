import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p37SupportTicketSystemSql = "\nALTER TABLE campus_support_ticket\n    ADD COLUMN IF NOT EXISTS \"source\" varchar NOT NULL DEFAULT 'customer';\nALTER TABLE campus_support_ticket\n    ADD COLUMN IF NOT EXISTS \"dedupeKey\" varchar;\nALTER TABLE campus_support_ticket\n    ALTER COLUMN \"customerId\" DROP NOT NULL;\nCREATE UNIQUE INDEX IF NOT EXISTS \"IDX_campus_support_ticket_dedupe\"\n    ON campus_support_ticket (\"dedupeKey\") WHERE \"dedupeKey\" IS NOT NULL;\nALTER TABLE \"order\"\n    ADD COLUMN IF NOT EXISTS \"customFieldsExceptionresolvedat\" timestamptz;\n";
export declare class P37SupportTicketSystemMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
