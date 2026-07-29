import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { MessageJob } from './message-job';
import { MessagePluginOptions } from './types';
export declare class MessagePlugin implements OnApplicationBootstrap {
    private messageJob;
    private static options;
    constructor(messageJob: MessageJob);
    static init(options?: MessagePluginOptions): Type<MessagePlugin>;
    onApplicationBootstrap(): Promise<void>;
}
