"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryModule = void 0;
const common_1 = require("@nestjs/common");
const config_module_1 = require("../config/config.module");
const connection_module_1 = require("../connection/connection.module");
const job_queue_module_1 = require("../job-queue/job-queue.module");
const process_context_module_1 = require("../process-context/process-context.module");
const settings_store_service_1 = require("../service/helpers/settings-store/settings-store.service");
const config_collector_1 = require("./collectors/config.collector");
const database_collector_1 = require("./collectors/database.collector");
const deployment_collector_1 = require("./collectors/deployment.collector");
const features_collector_1 = require("./collectors/features.collector");
const installation_id_collector_1 = require("./collectors/installation-id.collector");
const plugin_collector_1 = require("./collectors/plugin.collector");
const system_info_collector_1 = require("./collectors/system-info.collector");
const telemetry_service_1 = require("./telemetry.service");
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
let TelemetryModule = class TelemetryModule {
};
exports.TelemetryModule = TelemetryModule;
exports.TelemetryModule = TelemetryModule = __decorate([
    (0, common_1.Module)({
        imports: [process_context_module_1.ProcessContextModule, config_module_1.ConfigModule, connection_module_1.ConnectionModule, job_queue_module_1.JobQueueModule],
        providers: [
            telemetry_service_1.TelemetryService,
            settings_store_service_1.SettingsStoreService,
            installation_id_collector_1.InstallationIdCollector,
            system_info_collector_1.SystemInfoCollector,
            database_collector_1.DatabaseCollector,
            plugin_collector_1.PluginCollector,
            config_collector_1.ConfigCollector,
            deployment_collector_1.DeploymentCollector,
            features_collector_1.FeaturesCollector,
        ],
        exports: [telemetry_service_1.TelemetryService],
    })
], TelemetryModule);
//# sourceMappingURL=telemetry.module.js.map