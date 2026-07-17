import { ConfigService } from '../../config/config.service';
import { JobQueueService } from '../../job-queue/job-queue.service';
import { ProcessContext } from '../../process-context/process-context';
import { TelemetryDeployment } from '../telemetry.types';
/**
 * Cloud provider detection based on environment variables.
 * Exported for testing purposes.
 */
export declare const CLOUD_PROVIDERS: Array<{
    name: string;
    envVars: string[];
}>;
/**
 * Serverless environment detection.
 * Exported for testing purposes.
 */
export declare const SERVERLESS_ENV_VARS: string[];
/**
 * Collects deployment environment information for telemetry.
 */
export declare class DeploymentCollector {
    private readonly processContext;
    private readonly configService;
    private readonly jobQueueService;
    constructor(processContext: ProcessContext, configService: ConfigService, jobQueueService: JobQueueService);
    collect(): TelemetryDeployment;
    private isContainerized;
    private detectCloudProvider;
    private getWorkerMode;
    private isServerless;
}
