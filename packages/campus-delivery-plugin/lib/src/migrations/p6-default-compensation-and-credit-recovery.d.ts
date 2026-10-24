import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const P6_MARKER = "p6-default-compensation";
export declare const p6ClaimSql = "\nCREATE TABLE IF NOT EXISTS campus_migration_marker (\n  name varchar(255) PRIMARY KEY, \"appliedAt\" timestamptz DEFAULT now());\nINSERT INTO campus_migration_marker(name) VALUES ('p6-default-compensation')\nON CONFLICT (name) DO NOTHING\nRETURNING name;\n";
export declare const p6DefaultCompensationSql = "\n-- \u8D85\u65F6\u8D54\u4ED8\u9ED8\u8BA4\u5F00\uFF1Aentity default \u5DF2\u6539 true\uFF0C\u8FD9\u91CC\u628A\u5DF2\u6709 FALSE \u884C\u7FFB\u6210 TRUE\n-- \u7F3A\u5238\u6A21\u677F\u65F6 sweepTimeoutCompensation \u4F1A\u9650\u9891\u544A\u8B66\uFF0C\u4E0D\u4F1A\u5B9E\u9645\u8D54\u4ED8\nUPDATE campus_fulfillment_config\nSET \"timeoutCompensationEnabled\" = TRUE\nWHERE \"timeoutCompensationEnabled\" = FALSE;\n";
export declare class P6DefaultCompensationMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
