export interface LiveStreamingPluginOptions {
    /** 推流域名，如 rtmp://push.example.com/live/ */
    pushDomain?: string;
    /** 播放域名（HLS），如 https://play.example.com/live/ */
    playDomain?: string;
    /** 生成 streamKey 的随机串长度 */
    streamKeyLength?: number;
    /** 主播直播归因佣金比例（万分之几），默认 1000（10%） */
    liveCommissionRate?: number;
    /** ws 服务地址（供 Shop API 返回给前端），如 ws://localhost:3003 */
    wsUrl?: string;
    /** ws 服务共享密钥（签发 wsTicket 用） */
    wsSecret?: string;
}

export type LiveRoomStatus = 'scheduled' | 'live' | 'ended';
export type LiveRoomType = 'product' | 'show'; // product=带货直播 show=才艺/展示
