"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const common_1 = require("@nestjs/common");
const process_context_1 = require("../process-context/process-context");
const version_1 = require("../version");
const config_collector_1 = require("./collectors/config.collector");
const database_collector_1 = require("./collectors/database.collector");
const deployment_collector_1 = require("./collectors/deployment.collector");
const features_collector_1 = require("./collectors/features.collector");
const installation_id_collector_1 = require("./collectors/installation-id.collector");
const plugin_collector_1 = require("./collectors/plugin.collector");
const system_info_collector_1 = require("./collectors/system-info.collector");
const is_telemetry_disabled_helper_1 = require("./helpers/is-telemetry-disabled.helper");
const TELEMETRY_ENDPOINT = 'https://telemetry.vendure.io/api/v1/collect';
const TELEMETRY_TIMEOUT_MS = 5000;
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
let TelemetryService = class TelemetryService {
    constructor(processContext, installationIdCollector, systemInfoCollector, databaseCollector, pluginCollector, configCollector, deploymentCollector, featuresCollector) {
        this.processContext = processContext;
        this.installationIdCollector = installationIdCollector;
        this.systemInfoCollector = systemInfoCollector;
        this.databaseCollector = databaseCollector;
        this.pluginCollector = pluginCollector;
        this.configCollector = configCollector;
        this.deploymentCollector = deploymentCollector;
        this.featuresCollector = featuresCollector;
    }
    onApplicationBootstrap() {
        // Skip if worker process - only run from server
        if (this.processContext.isWorker) {
            return;
        }
        // Skip if disabled or CI environment
        if ((0, is_telemetry_disabled_helper_1.isTelemetryDisabled)()) {
            return;
        }
        // Delay telemetry collection to allow user bootstrap code to complete
        // This ensures JobQueueService.start() has been called (if it will be)
        // before we check worker mode
        this.delayTimeout = setTimeout(() => {
            this.delayTimeout = undefined;
            this.sendTelemetry().catch(() => {
                // Silently ignore all errors
            });
        }, 5000);
    }
    onApplicationShutdown() {
        if (this.delayTimeout) {
            clearTimeout(this.delayTimeout);
            this.delayTimeout = undefined;
        }
    }
    /**
     * Collects and sends telemetry data.
     */
    async sendTelemetry() {
        const payload = await this.collectPayload();
        await this.send(payload);
    }
    /**
     * Collects all telemetry data from the various collectors.
     */
    async collectPayload() {
        var _a, _b, _c, _d, _e;
        const installationId = await this.installationIdCollector.collect();
        const databaseInfo = await this.databaseCollector.collect();
        const systemInfo = this.systemInfoCollector.collect();
        const plugins = this.pluginCollector.collect();
        const collectedConfig = this.configCollector.collect();
        const deployment = this.deploymentCollector.collect();
        // Merge scale indicator counts from already-collected entity metrics
        // into a new object to avoid mutating the collector's return value
        const entities = (_b = (_a = databaseInfo.metrics) === null || _a === void 0 ? void 0 : _a.entities) !== null && _b !== void 0 ? _b : {};
        const config = Object.assign(Object.assign({}, collectedConfig), { channelCount: (_c = entities.Channel) !== null && _c !== void 0 ? _c : collectedConfig.channelCount, paymentMethodCount: (_d = entities.PaymentMethod) !== null && _d !== void 0 ? _d : collectedConfig.paymentMethodCount, shippingMethodCount: (_e = entities.ShippingMethod) !== null && _e !== void 0 ? _e : collectedConfig.shippingMethodCount });
        // FeaturesCollector derives flags from already-collected config
        // to avoid duplicating custom-field/scheduler iteration logic
        const features = await this.featuresCollector.collect(config);
        return {
            // Required fields
            installationId,
            timestamp: new Date().toISOString(),
            vendureVersion: version_1.VENDURE_VERSION,
            nodeVersion: systemInfo.nodeVersion,
            databaseType: databaseInfo.databaseType,
            // Optional fields
            environment: process.env.NODE_ENV,
            platform: systemInfo.platform,
            plugins,
            metrics: databaseInfo.metrics,
            deployment,
            config,
            features,
        };
    }
    /**
     * Sends the telemetry payload to the collection endpoint.
     * Uses a 5-second timeout to prevent blocking.
     */
    async send(payload) {
        const endpoint = TELEMETRY_ENDPOINT;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS);
        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
};
exports.TelemetryService = TelemetryService;
exports.TelemetryService = TelemetryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [process_context_1.ProcessContext,
        installation_id_collector_1.InstallationIdCollector,
        system_info_collector_1.SystemInfoCollector,
        database_collector_1.DatabaseCollector,
        plugin_collector_1.PluginCollector,
        config_collector_1.ConfigCollector,
        deployment_collector_1.DeploymentCollector,
        features_collector_1.FeaturesCollector])
], TelemetryService);
//# sourceMappingURL=telemetry.service.js.map