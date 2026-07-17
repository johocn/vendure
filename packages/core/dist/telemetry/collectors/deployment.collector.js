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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentCollector = exports.SERVERLESS_ENV_VARS = exports.CLOUD_PROVIDERS = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = __importDefault(require("node:fs"));
const config_service_1 = require("../../config/config.service");
const in_memory_job_queue_strategy_1 = require("../../job-queue/in-memory-job-queue-strategy");
const job_queue_service_1 = require("../../job-queue/job-queue.service");
const process_context_1 = require("../../process-context/process-context");
/**
 * Cloud provider detection based on environment variables.
 * Exported for testing purposes.
 */
exports.CLOUD_PROVIDERS = [
    { name: 'aws', envVars: ['AWS_REGION', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_EXECUTION_ENV'] },
    { name: 'gcp', envVars: ['GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT', 'GCP_PROJECT'] },
    { name: 'azure', envVars: ['AZURE_FUNCTIONS_ENVIRONMENT', 'WEBSITE_SITE_NAME'] },
    { name: 'vercel', envVars: ['VERCEL', 'VERCEL_ENV'] },
    { name: 'railway', envVars: ['RAILWAY_ENVIRONMENT', 'RAILWAY_PROJECT_ID'] },
    { name: 'render', envVars: ['RENDER', 'RENDER_SERVICE_ID'] },
    { name: 'fly', envVars: ['FLY_APP_NAME', 'FLY_REGION'] },
    { name: 'heroku', envVars: ['DYNO', 'HEROKU_APP_NAME'] },
    { name: 'digitalocean', envVars: ['DIGITALOCEAN_APP_NAME', 'DO_APP_PLATFORM'] },
    { name: 'northflank', envVars: ['NORTHFLANK_APP_NAME', 'NF_PROJECT_NAME'] },
];
/**
 * Serverless environment detection.
 * Exported for testing purposes.
 */
exports.SERVERLESS_ENV_VARS = [
    'AWS_LAMBDA_FUNCTION_NAME',
    'FUNCTION_NAME', // GCP Cloud Functions
    'AZURE_FUNCTIONS_ENVIRONMENT',
    'VERCEL_ENV',
    'NETLIFY_FUNCTIONS',
];
/**
 * Collects deployment environment information for telemetry.
 */
let DeploymentCollector = class DeploymentCollector {
    constructor(processContext, configService, jobQueueService) {
        this.processContext = processContext;
        this.configService = configService;
        this.jobQueueService = jobQueueService;
    }
    collect() {
        return {
            containerized: this.isContainerized(),
            cloudProvider: this.detectCloudProvider(),
            workerMode: this.getWorkerMode(),
            serverless: this.isServerless(),
        };
    }
    isContainerized() {
        // Check for Docker
        if (node_fs_1.default.existsSync('/.dockerenv')) {
            return true;
        }
        // Check for Kubernetes
        if (process.env.KUBERNETES_SERVICE_HOST) {
            return true;
        }
        // Check cgroup for containerization (Linux only)
        try {
            if (node_fs_1.default.existsSync('/proc/1/cgroup')) {
                const cgroup = node_fs_1.default.readFileSync('/proc/1/cgroup', 'utf-8');
                if (cgroup.includes('docker') ||
                    cgroup.includes('kubepods') ||
                    cgroup.includes('containerd')) {
                    return true;
                }
            }
        }
        catch (_a) {
            // Ignore errors
        }
        return false;
    }
    detectCloudProvider() {
        for (const provider of exports.CLOUD_PROVIDERS) {
            const hasEnvVar = provider.envVars.some(envVar => {
                const value = process.env[envVar];
                return value !== undefined && value !== '';
            });
            if (hasEnvVar) {
                return provider.name;
            }
        }
        return undefined;
    }
    getWorkerMode() {
        // If we're in a worker process, definitely separate
        if (this.processContext.isWorker) {
            return 'separate';
        }
        // Check JobQueueStrategy type - InMemoryJobQueueStrategy CANNOT work with separate workers
        const strategy = this.configService.jobQueueOptions.jobQueueStrategy;
        if (strategy instanceof in_memory_job_queue_strategy_1.InMemoryJobQueueStrategy) {
            return 'integrated';
        }
        // For external queue strategies, check if job queue was started in this server process
        // If started here → integrated mode (server is processing jobs)
        // If not started here → separate mode (a separate worker process handles jobs)
        return this.jobQueueService.started ? 'integrated' : 'separate';
    }
    isServerless() {
        return exports.SERVERLESS_ENV_VARS.some(envVar => {
            const value = process.env[envVar];
            return value !== undefined && value !== '';
        });
    }
};
exports.DeploymentCollector = DeploymentCollector;
exports.DeploymentCollector = DeploymentCollector = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [process_context_1.ProcessContext,
        config_service_1.ConfigService,
        job_queue_service_1.JobQueueService])
], DeploymentCollector);
//# sourceMappingURL=deployment.collector.js.map