export interface PinnedAddress {
    address: string;
    family: 4 | 6;
}
export type DnsResolverFn = (hostname: string) => Promise<Array<{
    address: string;
    family: number;
}>>;
/**
 * @description
 * Validates a URL before allowing the asset importer to fetch it. Rejects:
 * - non-http(s) schemes
 * - hostnames that resolve to private, loopback, link-local, IPv4-mapped IPv6
 *   or other non-public address ranges (covers SSRF against cloud metadata and
 *   internal services)
 *
 * On success, returns the parsed URL plus the address that was validated so the
 * caller can connect directly to that IP. Pinning the validated IP for the
 * subsequent fetch closes the DNS-rebinding TOCTOU window — without it,
 * `http.get` would perform a second, independent DNS lookup and could resolve
 * the same hostname to a private IP this time around.
 *
 * On failure, the thrown {@link InternalServerError} carries a generic message;
 * the specific reason (URL, resolved IP, remediation hint) is emitted via
 * `Logger.warn` so operators can see it without the client learning about the
 * `allowPrivateNetworks` bypass.
 *
 * Exported for unit testing; production callers should not pass a resolver
 * override.
 */
export declare function assertPublicUrl(urlString: string, options?: {
    allowPrivateNetworks?: boolean;
    resolver?: DnsResolverFn;
}): Promise<{
    url: URL;
    pinned: PinnedAddress | null;
}>;
