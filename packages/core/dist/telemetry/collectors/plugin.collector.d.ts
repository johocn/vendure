import { ConfigService } from '../../config/config.service';
import { TelemetryPluginInfo } from '../telemetry.types';
/**
 * Collects information about plugins used in the Vendure installation.
 * Detects npm packages by checking if the plugin originates from node_modules.
 * Custom plugin names are NOT collected for privacy.
 */
export declare class PluginCollector {
    private readonly configService;
    constructor(configService: ConfigService);
    collect(): TelemetryPluginInfo;
    /**
     * Finds the npm package name for a plugin.
     * First checks against known Vendure plugins, then falls back to require.cache inspection.
     */
    private findNpmPackage;
    /**
     * Searches the require cache for a plugin class.
     * This is a fallback for third-party npm plugins not in our known list.
     */
    private findInRequireCache;
    /**
     * Extracts the npm package name from a node_modules path.
     * Handles both scoped (@scope/package) and unscoped packages.
     */
    private extractPackageName;
}
