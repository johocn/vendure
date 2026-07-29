import { ChannelService, ID, JobQueueService } from '@vendure/core';
import { MessageService } from './message.service';
export interface SendMessageJobData {
    messageId: ID;
    channelId: ID;
}
export declare class MessageJob {
    private jobQueueService;
    private messageService;
    private channelService;
    private jobQueue;
    constructor(jobQueueService: JobQueueService, messageService: MessageService, channelService: ChannelService);
    init(): Promise<void>;
    addSendJob(messageId: ID, channelId: ID): Promise<void>;
}
