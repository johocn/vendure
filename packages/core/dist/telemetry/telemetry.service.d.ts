import { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ProcessContext } from '../process-context/process-context';
import { ConfigCollector } from './collectors/config.collector';
import { DatabaseCollector } from './collectors/database.collector';
import { DeploymentCollector } from './collectors/deployment.collector';
import { FeaturesCollector } from './collectors/features.collector';
import { InstallationIdCollector } from './collectors/installation-id.collector';
import { PluginCollector } from './collectors/plugin.collector';
import { SystemInfoCollector } from './collectors/system-info.collector';
/**
 * @description
 * The TelemetryService collects anonymous usage data on Vendure application startup
 * and sends it to the Vendure telemetry endpoint. This data helps the Vendure team
 * understand how the framework is being used and prioritize development efforts.
 *
 * **Privacy guarantees:**
 * - Installation ID is a random UUID, not derived from any system information
 * - Custom plugin names are NOT collected (only count)
 * - Entity counts use ranges, not exact numbers
 * - No PII (no hostnames, IPs, user data) is collected
 * - All failures are silently ignored
 *
 * **Opt-out:**
 * Set the environment variable `VENDURE_DISABLE_TELEMETRY=true` to disable telemetry.
 *
 * **CI environments:**
 * Telemetry is automatically disabled in CI environments.
 *
 * @docsCategory Telemetry
 * @since 3.6.0
 */
export declare class TelemetryService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly processContext;
    private readonly installationIdCollector;
    private readonly systemInfoCollector;
    private readonly databaseCollector;
    private readonly pluginCollector;
    private readonly configCollector;
    private readonly deploymentCollector;
    private readonly featuresCollector;
    private delayTimeout;
    constructor(processContext: ProcessContext, installationIdCollector: InstallationIdCollector, systemInfoCollector: SystemInfoCollector, databaseCollector: DatabaseCollector, pluginCollector: PluginCollector, configCollector: ConfigCollector, deploymentCollector: DeploymentCollector, featuresCollector: FeaturesCollector);
    onApplicationBootstrap(): void;
    onApplicationShutdown(): void;
    /**
     * Collects and sends telemetry data.
     */
    private sendTelemetry;
    /**
     * Collects all telemetry data from the various collectors.
     */
    private collectPayload;
    /**
     * Sends the telemetry payload to the collection endpoint.
     * Uses a 5-second timeout to prevent blocking.
     */
    private send;
}
