import { ModuleRef } from '@nestjs/core';
import { EventBus, RequestContext } from '@vendure/core';
import { EmailGenerator } from './generator/email-generator';
import { EmailSender } from './sender/email-sender';
import { EmailTransportOptions, InitializedEmailPluginOptions, IntermediateEmailDetails } from './types';
/**
 * This class combines the template loading, generation, and email sending - the actual "work" of
 * the EmailPlugin. It is arranged this way primarily to accommodate easier testing, so that the
 * tests can be run without needing all the JobQueue stuff which would require a full e2e test.
 */
export declare class EmailProcessor {
    protected options: InitializedEmailPluginOptions;
    private moduleRef;
    private eventBus;
    protected emailSender: EmailSender;
    protected generator: EmailGenerator;
    constructor(options: InitializedEmailPluginOptions, moduleRef: ModuleRef, eventBus: EventBus);
    init(): Promise<void>;
    process(data: IntermediateEmailDetails): Promise<boolean>;
    getTransportSettings(ctx?: RequestContext): Promise<EmailTransportOptions>;
}
