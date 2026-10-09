// 本地 Strapi 形态 mock：模拟 h.joho.cn 的 jianghu-event-copies 文案源。
// 仅用于本地联调 / 测试取文案链路；不参与生产。
// 用法：node strapi-mock.mjs  （默认 7788 端口，常驻）
//       STRAPI_MOCK_FLAT=1 node strapi-mock.mjs   → 输出 Strapi v5 的平铺结构（线上形态）
// 默认输出 Strapi v4 的 attributes 结构，用于确认两种格式都能被解析器正确吃掉。
import http from 'node:http';

const PORT = Number(process.env.STRAPI_MOCK_PORT || 7788);
const FLAT = process.env.STRAPI_MOCK_FLAT === '1';

const COPY = {
    id: 1,
    documentId: 'mock-doc-1',
    title: '测试·拾光传信者',
    desc: '本地 mock 文案：校园江湖试运营，密信/情报/事件簿三路齐发。',
    bannerImage: { url: 'https://h.joho.cn/uploads/mock-banner.png' },
    rewardText: '本地 mock 奖励：声望 +50，绝密信笺 ×1',
    active: true,
};

/** v4：字段藏进 attributes；v5：字段平铺在 document 上 */
const entry = FLAT
    ? { ...COPY }
    : { id: COPY.id, attributes: { title: COPY.title, desc: COPY.desc, bannerImage: COPY.bannerImage, rewardText: COPY.rewardText, active: COPY.active } };

const handler = (req, res) => {
  const url = req.url || '';
  if (req.method === 'GET' && url.startsWith('/api/jianghu-event-copies')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      data: [entry],
      meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } },
    }));
    return;
  }
  res.statusCode = 404;
  res.end('not found');
};

http.createServer(handler).listen(PORT, () => {
  console.log(`strapi-mock listening on http://localhost:${PORT}/api/jianghu-event-copies`);
});
