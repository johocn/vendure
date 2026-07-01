import { TransactionalConnection } from '../../connection/transactional-connection';
import { TelemetryConfig, TelemetryFeatures } from '../telemetry.types';
/**
 * Collects feature adoption flags for telemetry.
 * DB-dependent flags are resolved in parallel. Each flag is derived
 * independently so a single failure does not affect the others.
 *
 * Config-derived flags (`customFieldsInUse`, `scheduledTasks`) are read
 * from the already-collected `TelemetryConfig` to avoid duplicating
 * iteration logic that lives in `ConfigCollector`.
 */
export declare class FeaturesCollector {
    private readonly connection;
    constructor(connection: TransactionalConnection);
    collect(config: TelemetryConfig): Promise<TelemetryFeatures>;
    /**
     * Derives multiVendor from seller count + strategy name.
     * When DB is unavailable, returns `undefined` to stay consistent
     * with other DB-dependent flags — the strategy check alone is
     * not authoritative enough to report a definitive value.
     */
    private deriveMultiVendor;
    private safeCount;
}
