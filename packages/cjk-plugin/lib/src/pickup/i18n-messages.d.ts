import { LanguageCode, RequestContext } from '@vendure/core';
type MessageMap = Record<LanguageCode, string>;
export declare const ERROR_MESSAGES: Record<string, MessageMap>;
export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
export declare function translateError(ctx: RequestContext, key: ErrorMessageKey): string;
export {};
