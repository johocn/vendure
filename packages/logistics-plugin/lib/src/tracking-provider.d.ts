import { RequestContext } from '@vendure/core';
export interface LogisticsTrackingProvider {
    code: string;
    name: string;
    queryTrack(ctx: RequestContext, carrierCode: string, trackingNo: string): Promise<TrackResult>;
}
export interface TrackResult {
    status: string;
    signedAt?: Date;
    tracks: TrackNode[];
    raw?: any;
}
export interface TrackNode {
    time: string;
    location?: string;
    context: string;
}
export declare class NoopTrackingProvider implements LogisticsTrackingProvider {
    code: string;
    name: string;
    queryTrack(): Promise<TrackResult>;
}
