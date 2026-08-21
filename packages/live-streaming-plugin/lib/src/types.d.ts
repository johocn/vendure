export interface LiveStreamingPluginOptions {
    pushDomain?: string;
    playDomain?: string;
    streamKeyLength?: number;
    liveCommissionRate?: number;
    wsUrl?: string;
    wsSecret?: string;
}
export type LiveRoomStatus = 'scheduled' | 'live' | 'ended';
export type LiveRoomType = 'product' | 'show';
