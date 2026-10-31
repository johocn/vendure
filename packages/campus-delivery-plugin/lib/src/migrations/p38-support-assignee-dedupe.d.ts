import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p38SupportAssigneeDedupeSql = "\nALTER TABLE campus_support_ticket\n    ADD COLUMN IF NOT EXISTS \"assigneeId\" int;\nCREATE INDEX IF NOT EXISTS \"IDX_campus_support_ticket_assignee\"\n    ON campus_support_ticket (\"assigneeId\") WHERE \"assigneeId\" IS NOT NULL;\nCREATE TABLE IF NOT EXISTS campus_dedupe_key (\n    \"key\" varchar PRIMARY KEY,\n    \"expiresAt\" timestamptz NOT NULL,\n    counter int NOT NULL DEFAULT 0,\n    value jsonb\n);\nCREATE INDEX IF NOT EXISTS \"IDX_campus_dedupe_key_expires\"\n    ON campus_dedupe_key (\"expiresAt\");\n";
export declare class P38SupportAssigneeDedupeMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
