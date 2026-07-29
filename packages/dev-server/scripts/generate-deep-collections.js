"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * This script generates lots of Collections, nested 3 levels deep. It is useful for testing
 * scenarios where we need to work with a large amount of Collections.
 */
const collections = [];
for (let i = 1; i <= 20; i++) {
    const IName = `Collection ${i}`;
    collections.push({
        name: IName,
        filters: [],
    });
    for (let j = 1; j <= 5; j++) {
        const JName = `Collection ${i}-${j}`;
        collections.push({
            name: JName,
            filters: [],
            parentName: IName,
        });
        for (let k = 1; k <= 3; k++) {
            const KName = `Collection ${i}-${j}-${k}`;
            collections.push({
                name: KName,
                filters: [],
                parentName: JName,
            });
        }
    }
}
fs_1.default.writeFileSync(path_1.default.join(__dirname, 'collections.json'), JSON.stringify(collections, null, 2), 'utf-8');
//# sourceMappingURL=generate-deep-collections.js.map