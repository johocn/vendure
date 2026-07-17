import { Request } from 'express';
import { AuthOptions } from '../../config/vendure-config';
type ExtractArrayElement<T> = T extends ReadonlyArray<infer U> ? U : T;
export type ExtractTokenResult = {
    method: Exclude<ExtractArrayElement<AuthOptions['tokenMethod']>, undefined>;
    token: string;
};
/**
 * Depending on the configured `tokenMethod`, tries to extract a session token in the order:
 *
 * 1. Cookie
 * 2. Authorization Header
 * 3. API-Key Header
 *
 * @see {@link AuthOptions}
 */
export declare function extractSessionToken(req: Request, tokenMethod: Exclude<AuthOptions['tokenMethod'], undefined>, apiKeyHeaderKey: string): ExtractTokenResult | undefined;
export {};
