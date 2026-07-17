import { RequestContext, VendureEvent } from '@vendure/core';
import { EmailDetails, EmailMetadata } from './types';
/**
 * @description
 * This event is fired when an email sending attempt has been made. If the sending was successful,
 * the `success` property will be `true`, and if not, the `error` property will contain the error
 * which occurred.
 *
 * @docsCategory core plugins/EmailPlugin
 * @since 2.2.0
 */
export declare class EmailSendEvent extends VendureEvent {
    readonly ctx: RequestContext;
    readonly details: EmailDetails;
    readonly success: boolean;
    readonly error?: Error | undefined;
    readonly metadata?: EmailMetadata | undefined;
    constructor(ctx: RequestContext, details: EmailDetails, success: boolean, error?: Error | undefined, metadata?: EmailMetadata | undefined);
}
