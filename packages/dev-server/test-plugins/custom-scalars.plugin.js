"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomScalarsPlugin = void 0;
const core_1 = require("@vendure/core");
const graphql_1 = require("graphql");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const FooScalar = new graphql_1.GraphQLScalarType({
    name: 'FooScalar',
    description: 'A test scalar',
    serialize(value) {
        return value.toString() + '-foo';
    },
    parseValue(value) {
        return value.toString().split('-foo')[0];
    },
});
let CustomScalarsPlugin = class CustomScalarsPlugin {
};
exports.CustomScalarsPlugin = CustomScalarsPlugin;
exports.CustomScalarsPlugin = CustomScalarsPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        shopApiExtensions: {
            schema: (0, graphql_tag_1.default) `
            scalar FooScalar
        `,
            scalars: { FooScalar },
        },
    })
], CustomScalarsPlugin);
//# sourceMappingURL=custom-scalars.plugin.js.map