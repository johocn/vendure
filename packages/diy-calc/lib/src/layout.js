"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLayout = buildLayout;
const prng_1 = require("./prng");
function pickWeighted(palette, weights, rng, history) {
    // 同材质连续已达 3 颗时禁选；候选全被禁则退化为无约束
    const banned = history.length === 3 && history.every(m => m === history[0]) ? history[0] : null;
    const pool = [];
    const wpool = [];
    for (let i = 0; i < palette.length; i++) {
        if (palette[i] === banned)
            continue;
        pool.push(palette[i]);
        wpool.push(weights[i]);
    }
    const pickFrom = pool.length ? pool : palette;
    const pickW = pool.length ? wpool : weights;
    const total = pickW.reduce((s, w) => s + w, 0);
    let roll = rng() * total;
    let picked = pickFrom[pickFrom.length - 1];
    for (let i = 0; i < pickFrom.length; i++) {
        roll -= pickW[i];
        if (roll <= 0) {
            picked = pickFrom[i];
            break;
        }
    }
    history.push(picked);
    if (history.length > 3)
        history.shift();
    return picked;
}
/**
 * 确定性排布（§7.5）：
 * - angle = (index/count)·2π；depth = 0.5 + 0.5·sin(angle)（下半圈朝前）
 * - rotation = mulberry32(seed ^ (index·0x9E3779B1))·2π
 * - random 用独立随机流 mulberry32(seed ^ 0x51ED270B) 轮盘赌 + 连续同色约束
 * - 输出先按 angle 再按 depth 排，保证渲染稳定
 */
function buildLayout(input) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const { count, seed, pattern, materials } = input;
    const every = Math.max(0, Math.floor((_a = input.spacerEvery) !== null && _a !== void 0 ? _a : 0));
    const ratio = Math.max(1, Math.floor((_b = input.ratio) !== null && _b !== void 0 ? _b : 1));
    const randomRng = (0, prng_1.mulberry32)((seed ^ 0x51ed270b) | 0);
    const history = [];
    const beads = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        let materialId = (_c = materials.main) !== null && _c !== void 0 ? _c : '';
        let role = 'main';
        const isSpacer = every > 0 && !!materials.spacer && (i + 1) % (every + 1) === 0;
        if (pattern === 'focal' && i === 0 && materials.focal) {
            materialId = materials.focal;
        }
        else if (isSpacer) {
            materialId = materials.spacer;
            role = 'spacer';
        }
        else {
            switch (pattern) {
                case 'ab': {
                    const a = (_d = materials.main) !== null && _d !== void 0 ? _d : '';
                    const b = (_e = materials.secondary) !== null && _e !== void 0 ? _e : a;
                    materialId = i % (ratio + 1) < ratio ? a : b;
                    break;
                }
                case 'gradient': {
                    const palette = input.palette && input.palette.length >= 2
                        ? input.palette
                        : [(_f = materials.main) !== null && _f !== void 0 ? _f : '', (_g = materials.secondary) !== null && _g !== void 0 ? _g : ''];
                    const half = Math.floor(count / 2);
                    const dist = Math.min(i, count - 1 - i);
                    const t = half === 0 ? 0 : dist / half;
                    const gi = Math.min(palette.length - 1, Math.floor(t * palette.length));
                    materialId = palette[gi];
                    role = 'secondary';
                    break;
                }
                case 'random': {
                    const palette = input.palette && input.palette.length ? input.palette : [(_h = materials.main) !== null && _h !== void 0 ? _h : ''];
                    const weights = input.weights && input.weights.length === palette.length ? input.weights : palette.map(() => 1);
                    materialId = pickWeighted(palette, weights, randomRng, history);
                    break;
                }
                case 'solid':
                case 'focal':
                default:
                    materialId = (_j = materials.main) !== null && _j !== void 0 ? _j : '';
                    break;
            }
        }
        beads.push({
            index: i,
            angle,
            depth: 0.5 + 0.5 * Math.sin(angle),
            materialId,
            rotation: (0, prng_1.mulberry32)(seed ^ (i * 0x9e3779b1))() * 2 * Math.PI,
            role,
        });
    }
    beads.sort((a, b) => a.angle - b.angle || a.depth - b.depth);
    return { beads };
}
//# sourceMappingURL=layout.js.map