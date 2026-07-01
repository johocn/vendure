import { EmailAttachment, SerializedAttachment } from './types';
export declare function serializeAttachments(attachments: EmailAttachment[]): Promise<SerializedAttachment[]>;
export declare function deserializeAttachments(serializedAttachments: SerializedAttachment[]): EmailAttachment[];
