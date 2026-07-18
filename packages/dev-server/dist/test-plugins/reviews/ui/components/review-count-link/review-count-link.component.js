"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewCountLinkComponent = void 0;
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
let ReviewCountLinkComponent = class ReviewCountLinkComponent {
};
exports.ReviewCountLinkComponent = ReviewCountLinkComponent;
exports.ReviewCountLinkComponent = ReviewCountLinkComponent = __decorate([
    (0, core_1.Component)({
        selector: 'review-count-link',
        template: ` {{ formControl.value }} `,
        styles: [``],
        changeDetection: core_1.ChangeDetectionStrategy.OnPush,
        standalone: true,
        imports: [core_2.SharedModule],
    })
], ReviewCountLinkComponent);
//# sourceMappingURL=review-count-link.component.js.map