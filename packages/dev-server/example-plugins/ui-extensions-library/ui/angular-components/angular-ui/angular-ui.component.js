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
exports.AngularUiComponent = exports.DemoBlockComponent = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const core_2 = require("@vendure/admin-ui/core");
let DemoBlockComponent = class DemoBlockComponent {
};
exports.DemoBlockComponent = DemoBlockComponent;
__decorate([
    (0, core_1.Input)(),
    __metadata("design:type", String)
], DemoBlockComponent.prototype, "label", void 0);
exports.DemoBlockComponent = DemoBlockComponent = __decorate([
    (0, core_1.Component)({
        selector: 'demo-block',
        template: `
        <div class="mb-4">
            <label>{{ label }}</label>
            <div class="mt-1 flex" style="gap: 12px;">
                <ng-content />
            </div>
        </div>
    `,
        standalone: true,
    })
], DemoBlockComponent);
let AngularUiComponent = class AngularUiComponent {
    constructor(notificationService, pageMetadataService) {
        this.notificationService = notificationService;
        this.pageMetadataService = pageMetadataService;
        this.pageTitleControl = new forms_1.FormControl('Angular UI');
        this.invalidFormControl = new forms_1.FormControl('', () => ({ invalid: true }));
    }
    canDeactivate() {
        return this.pageTitleControl.pristine;
    }
    updateTitle() {
        const title = this.pageTitleControl.value;
        if (title) {
            this.pageMetadataService.setTitle(title);
            this.notificationService.success(`Updated title to "${title}"`);
            this.pageTitleControl.markAsPristine();
        }
    }
};
exports.AngularUiComponent = AngularUiComponent;
exports.AngularUiComponent = AngularUiComponent = __decorate([
    (0, core_1.Component)({
        selector: 'angular-ui',
        templateUrl: './angular-ui.component.html',
        standalone: true,
        imports: [core_2.SharedModule, DemoBlockComponent],
    }),
    __metadata("design:paramtypes", [core_2.NotificationService,
        core_2.PageMetadataService])
], AngularUiComponent);
//# sourceMappingURL=angular-ui.component.js.map