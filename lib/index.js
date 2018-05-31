"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// umask is blacklisted by node-client
process.umask = () => {
    return 18;
};
const neovim_1 = require("neovim");
const manager_1 = require("./manager");
const index_1 = require("./util/index");
const search_1 = require("./search");
const option_1 = require("./option");
const path = require("path");
const logger = require('./util/logger')('index');
let RenamePlugin = class RenamePlugin {
    constructor(nvim) {
        this.nvim = nvim;
        this.manager = new manager_1.default(nvim);
        this.searches = [];
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
    renameCharInsert(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { manager } = this;
            yield manager.onCharInsert(args[0]);
        });
    }
    renameSearch(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let exe = yield this.nvim.call('rename#get_execute');
            if (!exe)
                return;
            let cmd = exe.endsWith('ag') ? 'ag' : 'rg';
            let extraArgs = yield this.nvim.getVar('rename_search_extra_args');
            if (Array.isArray(extraArgs) && extraArgs.length) {
                args = extraArgs.concat(args);
            }
            let opts = option_1.convertOptions(args, cmd);
            let useVcs = yield this.nvim.getVar('rename_search_vcs_root');
            let cwd = yield this.nvim.call('getcwd');
            if (useVcs) {
                let full_path = yield this.nvim.call('rename#get_fullpath');
                let dir = full_path ? path.dirname(full_path) : cwd;
                dir = index_1.findVcsRoot(dir);
                if (dir)
                    cwd = dir;
            }
            let search = new search_1.default(this.nvim, cmd, opts, cwd);
            yield search.start();
            this.searches.push(search);
        });
    }
    renameSearchCompleteFunc(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let lead = args[0];
            return option_1.optionList.filter(s => s.indexOf(lead) === 0);
        });
    }
    renameBufferUnload(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let bufnr = args[0];
            let search = this.searches.find(o => o.bufnr == bufnr);
            if (search) {
                yield search.stop(false);
                let idx = this.searches.findIndex(o => o === search);
                this.searches.splice(idx, 1);
            }
        });
    }
    renameSearchAction(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let [action, ...opts] = args;
            switch (action) {
                case 'stop':
                    yield this.stopSearch(opts[0] == '!');
                    break;
                case 'open':
                    yield this.openFile(opts[0]);
                    break;
                case 'move':
                    yield this.onMove(opts[0]);
                    break;
                default:
                    logger.debug('not implementated');
            }
        });
    }
    stopSearch(force) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let search = yield this.getSearch();
            if (search)
                yield search.stop(force);
        });
    }
    getSearch() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let bufnr = yield this.nvim.call('bufnr', ['%']);
            let search = this.searches.find(o => o.bufnr == bufnr);
            return search;
        });
    }
    openFile(openType) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim } = this;
            let line = yield nvim.call('getline', ['.']);
            if (!/\d+[-:]/.test(line))
                return;
            let lnum = Number(line.match(/(\d+)[-:]/)[1]);
            let search = yield this.getSearch();
            if (!search)
                return;
            let filepath = yield nvim.call('rename#get_filepath');
            if (!filepath)
                return;
            let cwd = yield nvim.call('getcwd');
            let orig_cwd = yield nvim.eval('b:search_cwd');
            let fullpath = path.join(orig_cwd, filepath);
            let file = path.relative(cwd, fullpath);
            switch (openType) {
                case 0 /* Edit */:
                    yield nvim.command(`edit +${lnum} ${file}`);
                    break;
                case 1 /* Split */:
                    yield nvim.command(`sp +${lnum} ${file}`);
                    break;
                case 2 /* Tab */:
                    yield nvim.command(`tabe +${lnum} ${file}`);
                    break;
                case 3 /* Preview */:
                    yield nvim.command(`pedit +${lnum} ${file}`);
                    break;
            }
        });
    }
    onMove(moveType) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let search = yield this.getSearch();
            if (!search)
                return;
            let [_, lnum, col] = yield this.nvim.call('getcurpos');
            let arr;
            switch (moveType) {
                case 'prev':
                    arr = search.getPrevPosition(lnum - 1, col - 1);
                    break;
                case 'next':
                    arr = search.getNextPosition(lnum - 1, col - 1);
                    break;
            }
            if (arr) {
                let [lnum, col, index, len] = arr;
                yield this.nvim.call('cursor', [lnum + 1, col + 1]);
                yield index_1.echoMessage(this.nvim, `matches ${index} of ${len}`);
            }
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
], RenamePlugin.prototype, "renameCharInsert", null);
tslib_1.__decorate([
    neovim_1.Command('RenameSearch', {
        nargs: '+',
        sync: true,
        complete: 'customlist,RenameSearchCompleteFunc'
    })
], RenamePlugin.prototype, "renameSearch", null);
tslib_1.__decorate([
    neovim_1.Function('RenameSearchCompleteFunc', { sync: true })
], RenamePlugin.prototype, "renameSearchCompleteFunc", null);
tslib_1.__decorate([
    neovim_1.Function('RenameBufferUnload', { sync: true })
], RenamePlugin.prototype, "renameBufferUnload", null);
tslib_1.__decorate([
    neovim_1.Function('RenameSearchAction', { sync: true })
], RenamePlugin.prototype, "renameSearchAction", null);
RenamePlugin = tslib_1.__decorate([
    neovim_1.Plugin({ dev: false })
], RenamePlugin);
exports.default = RenamePlugin;
//# sourceMappingURL=index.js.map