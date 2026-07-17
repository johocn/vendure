import { RequestContext } from '@vendure/core';

export interface LogisticsTrackingProvider {
    code: string;
    name: string;
    queryTrack(ctx: RequestContext, carrierCode: string, trackingNo: string): Promise<TrackResult>;
}

export interface TrackResult {
    status: string; // unknown/in_transit/delivered/rejected/returned
    signedAt?: Date;
    tracks: TrackNode[]; // 物流轨迹节点
    raw?: any;
}

export interface TrackNode {
    time: string; // YYYY-MM-DD HH:mm:ss
    location?: string;
    context: string; // 轨迹描述
}

export class NoopTrackingProvider implements LogisticsTrackingProvider {
    code = 'noop';
    name = 'Noop (未配置)';
    async queryTrack(): Promise<TrackResult> {
        return { status: 'unknown', tracks: [] };
    }
}
