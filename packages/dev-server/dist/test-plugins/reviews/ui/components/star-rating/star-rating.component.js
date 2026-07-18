"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarRatingComponent = void 0;
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
let StarRatingComponent = class StarRatingComponent {
    constructor() {
        this.showLabel = false;
    }
    get starRating() {
        return this.formControl ? this.formControl.value : this.rating;
    }
    get stars() {
        const rating = this.starRating;
        return Array.from({ length: 5 }).map((_, i) => {
            const pos = i + 1;
            const filled = rating >= pos;
            if (filled) {
                return 'full';
            }
            if (Math.ceil(rating) < pos) {
                return 'empty';
            }
            return 'half';
        });
    }
};
exports.StarRatingComponent = StarRatingComponent;
__decorate([
    (0, core_1.Input)(),
    __metadata("design:type", Object)
], StarRatingComponent.prototype, "rating", void 0);
__decorate([
    (0, core_1.Input)(),
    __metadata("design:type", Object)
], StarRatingComponent.prototype, "showLabel", void 0);
exports.StarRatingComponent = StarRatingComponent = __decorate([
    (0, core_1.Component)({
        selector: 'star-rating',
        templateUrl: './star-rating.component.html',
        styleUrls: ['./star-rating.component.scss'],
        changeDetection: core_1.ChangeDetectionStrategy.Default,
        standalone: true,
        imports: [core_2.SharedModule],
    })
], StarRatingComponent);
//# sourceMappingURL=star-rating.component.js.map