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
exports.MessageJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const message_service_1 = require("./message.service");
let MessageJob = class MessageJob {
    constructor(jobQueueService, messageService, channelService) {
        this.jobQueueService = jobQueueService;
        this.messageService = messageService;
        this.channelService = channelService;
    }
    async init() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'send-message',
            process: async (job) => {
                const { messageId, channelId } = job.data;
                const channel = await this.channelService.getChannelFromToken(channelId);
                const ctx = new core_1.RequestContext({
                    apiType: 'admin',
                    channel,
                    isAuthorized: true,
                    authorizedAsOwnerOnly: false,
                });
                await this.messageService.processSending(ctx, messageId);
            },
        });
        core_1.Logger.info('MessageJob queue initialized', constants_1.loggerCtx);
    }
    async addSendJob(messageId, channelId) {
        await this.jobQueue.add({ messageId, channelId });
    }
};
exports.MessageJob = MessageJob;
exports.MessageJob = MessageJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService,
        message_service_1.MessageService,
        core_1.ChannelService])
], MessageJob);
