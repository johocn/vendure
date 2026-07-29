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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobQueueStressTestPlugin = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
let TestQueueService = class TestQueueService {
    constructor(jobQueueService) {
        this.jobQueueService = jobQueueService;
    }
    async onModuleInit() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'test-queue',
            process: async (job) => {
                // Process the job here
                core_1.Logger.info(`Processing job with message: ${job.data.message}`, 'TestQueueService');
                if (Math.random() < 0.2) {
                    throw new Error('Random failure occurred while processing job');
                }
                return { processed: true, message: job.data.message };
            },
        });
    }
    addJob(message) {
        return this.jobQueue.add({ message });
    }
    async generateJobs(count) {
        const jobs = [];
        for (let i = 0; i < count; i++) {
            jobs.push(this.addJob(`Test job ${i + 1}`));
            // await new Promise(resolve => setTimeout(resolve, 100));
        }
        return Promise.all(jobs);
    }
};
TestQueueService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService])
], TestQueueService);
let TestQueueResolver = class TestQueueResolver {
    constructor(testQueueService) {
        this.testQueueService = testQueueService;
    }
    async generateTestJobs(args) {
        const jobs = await this.testQueueService.generateJobs(args.jobCount);
        return {
            success: true,
            jobCount: jobs.length,
        };
    }
};
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TestQueueResolver.prototype, "generateTestJobs", null);
TestQueueResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [TestQueueService])
], TestQueueResolver);
/**
 * This plugin can create a large number of jobs in the job queue, which we
 * can then use to stress test the job queue's ability to return lists of jobs.
 */
let JobQueueStressTestPlugin = class JobQueueStressTestPlugin {
};
exports.JobQueueStressTestPlugin = JobQueueStressTestPlugin;
exports.JobQueueStressTestPlugin = JobQueueStressTestPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [TestQueueService],
        adminApiExtensions: {
            schema: (0, graphql_tag_1.default) `
            extend type Mutation {
                generateTestJobs(jobCount: Int!): GenerateTestJobsResult!
            }

            type GenerateTestJobsResult {
                success: Boolean!
                jobCount: Int!
            }
        `,
            resolvers: [TestQueueResolver],
        },
    })
], JobQueueStressTestPlugin);
//# sourceMappingURL=job-queue-stress-test.plugin.js.map