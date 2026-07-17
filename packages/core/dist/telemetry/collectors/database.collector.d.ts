import { ConfigService } from '../../config/config.service';
import { TransactionalConnection } from '../../connection/transactional-connection';
import { SupportedDatabaseType, TelemetryEntityMetrics } from '../telemetry.types';
export interface DatabaseInfo {
    databaseType: SupportedDatabaseType;
    metrics: TelemetryEntityMetrics;
}
/**
 * Collects database type and entity metrics for telemetry.
 */
export declare class DatabaseCollector {
    private readonly configService;
    private readonly connection;
    constructor(configService: ConfigService, connection: TransactionalConnection);
    collect(): Promise<DatabaseInfo>;
    private getDatabaseType;
    private collectEntityMetrics;
    private safeCount;
    private getCustomEntities;
}
