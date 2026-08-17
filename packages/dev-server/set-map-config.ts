/* eslint-disable no-console */
/**
 * 设置 default channel 的地图配置（高德 apiKey / securityJsCode）。
 * 用法: node -r ts-node/register -r dotenv/config -r tsconfig-paths/register set-map-config.ts <apiKey> [securityJsCode]
 *
 * 高德 JS API 2.0 若开启「域名白名单 + 安全密钥」则需传入 securityJsCode。
 */
import { bootstrap, ChannelService, RequestContextService } from '@vendure/core';
import { devConfig } from './dev-config';
import { MapConfigService } from '../cjk-plugin/lib/src/map/map-config.service';

if (require.main === module) {
    const apiKey = process.argv[2];
    const securityJsCode = process.argv[3] || '';

    if (!apiKey) {
        console.error('用法: node -r ts-node/register -r dotenv/config -r tsconfig-paths/register set-map-config.ts <apiKey> [securityJsCode]');
        process.exit(1);
    }

    bootstrap(devConfig)
        .then(async app => {
            const requestContextService = app.get(RequestContextService);
            const channelService = app.get(ChannelService);
            const mapConfigService = app.get(MapConfigService);

            const ctx = await requestContextService.create({
                apiType: 'admin',
                channelOrToken: 'default-token',
            });

            const defaultChannel = await channelService.getDefaultChannel(ctx);

            const patch: any = { provider: 'amap', apiKey };
            if (securityJsCode) patch.securityJsCode = securityJsCode;

            await mapConfigService.update(ctx, defaultChannel.id as string, patch);

            const masked = await mapConfigService.getMasked(ctx, defaultChannel.id as string);
            console.log('地图配置已写入 default channel:', JSON.stringify(masked));

            await app.close();
            process.exit(0);
        })
        .catch(err => {
            console.error('失败:', err);
            process.exit(1);
        });
}
