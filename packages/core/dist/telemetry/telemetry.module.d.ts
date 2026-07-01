/**
 * @description
 * The TelemetryModule provides anonymous usage data collection for Vendure.
 * It collects data on application startup and sends it to the Vendure telemetry endpoint.
 *
 * **Privacy guarantees:**
 * - Installation ID is a random UUID
 * - Custom plugin names are NOT collected
 * - Entity counts use ranges, not exact numbers
 * - No PII is collected
 *
 * **Opt-out:**
 * Set `VENDURE_DISABLE_TELEMETRY=true` to disable.
 *
 * @docsCategory Telemetry
 * @since 3.6.0
 */
export declare class TelemetryModule {
}
