"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CmsDataService = void 0;
const core_1 = require("@angular/core");
const rxjs_1 = require("rxjs");
let CmsDataService = class CmsDataService {
    getDataFor(id) {
        return (0, rxjs_1.of)({
            id,
            blogPostUrl: 'https://example.com/blog/' + id,
            blogPostTitle: 'Example Blog Post',
            blogTags: ['tag1', 'tag2', 'tag3'],
        });
    }
};
exports.CmsDataService = CmsDataService;
exports.CmsDataService = CmsDataService = __decorate([
    (0, core_1.Injectable)()
], CmsDataService);
//# sourceMappingURL=cms-data.service.js.map