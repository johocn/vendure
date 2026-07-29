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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobQueueTestPlugin = exports.JobQueueTestResolver = exports.JobQueueTestService = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const graphql_tag_1 = require("graphql-tag");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let queueCount = 1;
let JobQueueTestService = class JobQueueTestService {
    constructor(jobQueueService) {
        this.jobQueueService = jobQueueService;
        this.queues = [];
    }
    async onModuleInit() {
        for (let i = 0; i < queueCount; i++) {
            const queue = await this.jobQueueService.createQueue({
                name: `test-queue-${i + 1}`,
                process: async (job) => {
                    core_1.Logger.info(`Starting job ${job.id}, shouldFail: ${JSON.stringify(job.data.shouldFail)}`);
                    let progress = 0;
                    while (progress < 100) {
                        // Logger.info(`Job ${job.id} progress: ${progress}`);
                        await new Promise(resolve => setTimeout(resolve, job.data.intervalMs));
                        progress += 10;
                        job.setProgress(progress);
                        if (progress > 70 && job.data.shouldFail) {
                            core_1.Logger.warn(`Job ${job.id} will fail`);
                            throw new Error(`Job failed!!`);
                        }
                    }
                    core_1.Logger.info(`Completed job ${job.id}`);
                    return 'Done!';
                },
            });
            this.queues.push(queue);
        }
    }
    async startTask(input) {
        const { intervalMs, shouldFail, subscribeToResult, retries } = input;
        const updates = [];
        for (const queue of this.queues) {
            const job = await queue.add({ intervalMs, shouldFail }, { retries });
            if (subscribeToResult) {
                updates.push(job.updates().pipe((0, operators_1.map)(update => {
                    core_1.Logger.info(`Job ${update.id}: progress: ${update.progress}`);
                    if (update.state === generated_types_1.JobState.COMPLETED) {
                        core_1.Logger.info(`COMPLETED: ${JSON.stringify(update.result, null, 2)}`);
                        return update.result;
                    }
                    return update.progress;
                }), (0, operators_1.catchError)(err => (0, rxjs_1.of)(err.message))));
            }
        }
        if (subscribeToResult) {
            return (0, rxjs_1.forkJoin)(...updates);
        }
        else {
            return 'running in background';
        }
    }
};
exports.JobQueueTestService = JobQueueTestService;
exports.JobQueueTestService = JobQueueTestService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService])
], JobQueueTestService);
let JobQueueTestResolver = class JobQueueTestResolver {
    constructor(service) {
        this.service = service;
    }
    startTask(args) {
        return this.service.startTask(args.input);
    }
};
exports.JobQueueTestResolver = JobQueueTestResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], JobQueueTestResolver.prototype, "startTask", null);
exports.JobQueueTestResolver = JobQueueTestResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [JobQueueTestService])
], JobQueueTestResolver);
/**
 * A plugin which can be used to test job queue strategies. Exposes a mutation `startTask` in
 * the Admin API which triggers a job.
 */
let JobQueueTestPlugin = class JobQueueTestPlugin {
    static init(options) {
        queueCount = options.queueCount;
        return this;
    }
};
exports.JobQueueTestPlugin = JobQueueTestPlugin;
exports.JobQueueTestPlugin = JobQueueTestPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        adminApiExtensions: {
            resolvers: [JobQueueTestResolver],
            schema: (0, graphql_tag_1.gql) `
            input TaskConfigInput {
                intervalMs: Int!
                shouldFail: Boolean!
                retries: Int
                subscribeToResult: Boolean
            }
            extend type Mutation {
                startTask(input: TaskConfigInput!): JSON!
            }
        `,
        },
        providers: [JobQueueTestService],
    })
], JobQueueTestPlugin);
//# sourceMappingURL=job-queue-test-plugin.js.map