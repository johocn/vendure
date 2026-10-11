/**
 * mulberry32：确定性伪随机数生成器（PRNG）。
 * 同 seed 必产生同一序列——随机混色/纹理旋转种子可复现的关键。
 */
export declare function mulberry32(seed: number): () => number;
