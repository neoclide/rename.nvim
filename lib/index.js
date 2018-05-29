"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// umask is blacklisted by node-client
process.umask = () => {
    return 18;
};
const neovim_1 = require("neovim");
const manager_1 = require("./manager");
const logger = require('./util/logger')('index');
let RenamePlugin = class RenamePlugin {
    constructor(nvim) {
        this.nvim = nvim;
        this.manager = new manager_1.default(nvim);
    }
    renameStart(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let opts = args[0];
            yield this.manager.start(opts);
        });
    }
    renameToggle(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let pos = yield this.nvim.call('getcurpos');
            yield this.manager.toggleActive(pos[1], pos[2]);
        });
    }
    renameNext() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.manager.nextItem();
        });
    }
    renamePrev() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.manager.prevItem();
        });
    }
    renameEdge() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.manager.navigateFirst();
        });
    }
    renameEnd() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.manager.navigateLast();
        });
    }
    renameCancel(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let bufnr = args.length ? Number(args[0]) : yield this.nvim.call('bufnr', ['%']);
            if (bufnr === this.manager.bufnr) {
                yield this.manager.stop();
            }
        });
    }
    reanmeCharInsert(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { manager } = this;
            yield manager.onCharInsert(args[0]);
        });
    }
};
tslib_1.__decorate([
    neovim_1.Function('RenameStart', { sync: true })
], RenamePlugin.prototype, "renameStart", null);
tslib_1.__decorate([
    neovim_1.Function('RenameToggle', { sync: true })
], RenamePlugin.prototype, "renameToggle", null);
tslib_1.__decorate([
    neovim_1.Function('RenameNext', { sync: false })
], RenamePlugin.prototype, "renameNext", null);
tslib_1.__decorate([
    neovim_1.Function('RenamePrev', { sync: false })
], RenamePlugin.prototype, "renamePrev", null);
tslib_1.__decorate([
    neovim_1.Function('RenameBegin', { sync: false })
], RenamePlugin.prototype, "renameEdge", null);
tslib_1.__decorate([
    neovim_1.Function('RenameEnd', { sync: false })
], RenamePlugin.prototype, "renameEnd", null);
tslib_1.__decorate([
    neovim_1.Function('RenameCancel', { sync: false })
], RenamePlugin.prototype, "renameCancel", null);
tslib_1.__decorate([
    neovim_1.Function('RenameCharInsert', { sync: false })
], RenamePlugin.prototype, "reanmeCharInsert", null);
RenamePlugin = tslib_1.__decorate([
    neovim_1.Plugin({ dev: false })
], RenamePlugin);
exports.default = RenamePlugin;
//# sourceMappingURL=index.js.map