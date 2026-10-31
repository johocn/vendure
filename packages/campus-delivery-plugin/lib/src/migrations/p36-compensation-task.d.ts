import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p36CompensationTaskSql = "\nCREATE TABLE IF NOT EXISTS campus_compensation_task (\n    id serial PRIMARY KEY,\n    \"orderId\" int NOT NULL,\n    \"channelId\" int NOT NULL,\n    \"customerId\" int,\n    kind varchar NOT NULL,\n    payload text,\n    \"dedupeKey\" varchar NOT NULL,\n    status varchar NOT NULL DEFAULT 'pending',\n    attempts int NOT NULL DEFAULT 0,\n    \"nextAttemptAt\" timestamp,\n    \"lastError\" varchar,\n    \"createdAt\" timestamp NOT NULL DEFAULT now(),\n    \"updatedAt\" timestamp NOT NULL DEFAULT now()\n);\nCREATE UNIQUE INDEX IF NOT EXISTS \"IDX_campus_compensation_dedupe\" ON campus_compensation_task (\"dedupeKey\");\nCREATE INDEX IF NOT EXISTS \"IDX_campus_compensation_due\" ON campus_compensation_task (status, \"nextAttemptAt\");\n";
export declare class P36CompensationTaskMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
