export interface MemberLevelPluginOptions {
    /** Default points earn ratio when channel customField not set. */
    defaultPointsEarnRatio?: number;
    /** Default whether shipping earns points when channel customField not set. */
    defaultPointsEarnOnShipping?: boolean;
    /** Default points expiry days when channel customField not set (0 = never expire). */
    defaultPointsExpireDays?: number;
}
