-- dbtool 种子示例：创建 usemall 风格模板「mall」（L2 shop_template，app=nshop）
-- 主色 A2 珊瑚粉点缀版：主色 #e0433f · 强调 #ff6a6c · 圆角 8（引用 palette scheme usemall-coral）
-- 版式 B3：配色 + 首页积木 + 详情页 mall layout。
-- 幂等：按 name+app 判存（存在则跳过；需覆盖请先手动改版本）。

-- theme 结构：{ palette: { scheme, name, tokens } }（scheme 为 C 端预设字典 Key，优先 scheme 解码）
INSERT INTO shop_template ("createdAt", "updatedAt", name, app, theme, pages, version, enabled)
SELECT now(), now(),
       'mall',
       'nshop',
       '{"palette":{"scheme":"usemall-coral","name":"珊瑚粉点缀","tokens":{"primaryColor":"#e0433f","accentColor":"#ff6a6c","radius":8}}}',
       '{"product":{"version":2,"layout":"mall"},"home":{"sections":[{"type":"banner","data":{}},{"type":"nav","data":{}},{"type":"goods","data":{}}]},"category":{"version":1,"layout":"mall"}}',
       1,
       true
WHERE NOT EXISTS (SELECT 1 FROM shop_template WHERE name = 'mall' AND app = 'nshop');