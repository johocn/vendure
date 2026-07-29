import { Injectable } from '@nestjs/common';
import { ChannelService, ID, JobQueue, JobQueueService, Logger, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';
import { MessageService } from './message.service';

export interface SendMessageJobData {
    messageId: ID;
    channelId: ID;
}

@Injectable()
export class MessageJob {
    private jobQueue!: JobQueue<SendMessageJobData>;

    constructor(
        private jobQueueService: JobQueueService,
        private messageService: MessageService,
        private channelService: ChannelService,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'send-message',
            process: async (job) => {
                const { messageId, channelId } = job.data;
                const channel = await this.channelService.getChannelFromToken(channelId as any);
                const ctx = new RequestContext({
                    apiType: 'admin',
                    channel,
                    isAuthorized: true,
                    authorizedAsOwnerOnly: false,
                });
                await this.messageService.processSending(ctx, messageId);
            },
        });
        Logger.info('MessageJob queue initialized', loggerCtx);
    }

    async addSendJob(messageId: ID, channelId: ID): Promise<void> {
        await this.jobQueue.add({ messageId, channelId });
    }
}
