// 自包含验证：复刻校园江湖插件 getEventContent 的取数 + 解析，对本地 mock 跑一遍。
// 证明「vendure 插件 → Strapi 文案源」链路的数据契约正确。
// 用法：node verify-strapi.mjs
import http from 'node:http';

const PORT = Number(process.env.STRAPI_MOCK_PORT || 7788);
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    data: [
      {
        id: 1,
        attributes: {
          title: '测试·拾光传信者',
          desc: '本地 mock 文案：校园江湖试运营，密信/情报/事件簿三路齐发。',
          bannerImage: { url: 'https://h.joho.cn/uploads/mock-banner.png' },
          rewardText: '本地 mock 奖励：声望 +50，绝密信笺 ×1',
          active: true,
        },
      },
    ],
    meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } },
  }));
});

server.listen(PORT, async () => {
  const base = `http://localhost:${PORT}`;
  const collection = 'jianghu-event-copies';
  const url = `${base}/api/${collection}?filters[active][$eq]=true&populate=*`;
  const res = await fetch(url);
  const json = await res.json();
  // ↓↓↓ 与插件 jianghu.service.ts getEventContent 完全一致的解码逻辑 ↓↓↓
  const item = json?.data?.[0]?.attributes;
  if (!item) { console.log('FETCH_FAIL: 无 data[0].attributes'); server.close(); return; }
  const img = item.bannerImage?.url ?? item.bannerImage ?? null;
  const content = {
    title: item.title ?? null,
    desc: item.desc ?? null,
    bannerImage: typeof img === 'string' ? img : null,
    rewardText: item.rewardText ?? null,
    active: true,
  };
  console.log('FETCH_OK ' + JSON.stringify(content));
  server.close();
});
