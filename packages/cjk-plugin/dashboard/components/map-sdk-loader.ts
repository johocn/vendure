// e:\code\vendure\packages\cjk-plugin\dashboard\components\map-sdk-loader.ts
// 单例模式，避免重复加载
let sdkPromise: Promise<any> | null = null;

export async function loadMapSdk(sdkUrl: string): Promise<any> {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = sdkUrl;
        script.async = true;
        script.onload = () => {
            const AMap = (window as any).AMap;
            if (AMap) {
                resolve(AMap);
            } else {
                reject(new Error('高德 SDK 加载完成但 window.AMap 未定义'));
            }
        };
        script.onerror = () => {
            sdkPromise = null; // 允许重试
            reject(new Error('高德 SDK 加载失败'));
        };
        document.head.appendChild(script);
    });
    return sdkPromise;
}

export function resetSdkLoader(): void {
    sdkPromise = null;
}
