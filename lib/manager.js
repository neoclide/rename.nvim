"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const line_1 = require("./model/line");
const chars_1 = require("./model/chars");
const index_1 = require("./util/index");
const logger = require('./util/logger')('manager');
class Manager {
    constructor(nvim) {
        this.activted = false;
        this.nvim = nvim;
        this.srcId = 9527;
        nvim.on('notification', (name, args) => {
            if (!this.activted)
                return;
            if (name === 'nvim_buf_lines_event') {
                let [buf, tick, firstline, lastline, linedata, more] = args;
                let ts = this.lastChangeTs;
                let line = this.lines.find(o => o.lnum == firstline + 1);
                if (!this.buffer.equals(buf))
                    return;
                // caused by set lines
                if (ts && Date.now() - ts < 20)
                    return;
                if (!line
                    || lastline - firstline != 1
                    || linedata.length != 1) {
                    this.stop().catch(err => {
                        // echoErr(nvim, 'Unexpected line change detected').catch(() => { })
                    });
                    return;
                }
                this.onLineChange(line, linedata[0]).catch(e => {
                    logger.error(e.stack);
                });
            }
        });
    }
    onLineChange(line, content) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { lines, chars, srcId, minLnum, nvim, maxLnum, activted, buffer } = this;
            if (!activted)
                return;
            let [_, lnum, col] = yield nvim.call('getcurpos', []);
            let mode = yield nvim.call('mode', []);
            let currWord = this.getWordAhead(content, mode == 'i' ? col - 1 : col);
            let af = chars.splitString(line.content);
            let at = chars.splitString(content);
            let [replacedWord, newWord] = index_1.diffString(af, at);
            if (replacedWord != line.word || lnum != line.lnum) {
                yield index_1.echoWarning(nvim, 'Other word get changed');
                yield this.stop();
                return;
            }
            let dc = index_1.byteLength(newWord) - index_1.byteLength(replacedWord);
            let end = mode == 'i' ? col - currWord.length - 1 : col - currWord.length;
            let pl = line.activeRanges.filter(r => (r.start + r.len) < end).length;
            this.state = 'edit';
            let newLines = yield buffer.getLines({
                start: minLnum - 1,
                end: maxLnum,
                strictIndexing: false
            });
            let hls = [];
            for (let line of this.lines) {
                line.setNewWord(newWord);
                line.resetRanges();
                let { activeRanges, lnum, content } = line;
                newLines[lnum - minLnum] = content;
                hls = hls.concat(activeRanges.map(r => {
                    return { lnum, start: r.start, end: r.start + r.len };
                }));
            }
            this.lastChangeTs = Date.now();
            yield buffer.setLines(newLines, {
                start: minLnum - 1,
                end: maxLnum,
                strictIndexing: false
            });
            // fix cursor position
            if (pl) {
                col = col + pl * dc;
                yield nvim.call('cursor', [lnum, col]);
            }
            yield buffer.clearHighlight({ srcId });
            yield Promise.all(hls.map(o => {
                return this.addHighlight(o.lnum, o.start, o.end);
            }));
        });
    }
    addHighlight(lnum, start, end) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { buffer, srcId } = this;
            yield buffer.addHighlight({
                srcId,
                hlGroup: 'NvimRename',
                line: lnum - 1,
                colStart: start,
                colEnd: end,
                async: true
            });
        });
    }
    start(opts) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { activted, nvim } = this;
            if (activted)
                return;
            let { content, lnum, bufnr, col, cword, iskeyword, ignorePattern } = opts;
            let chars = this.chars = new chars_1.Chars(iskeyword);
            let contents = content.split(/\n/g);
            let lines = this.lines = [];
            let buffer = this.buffer = yield nvim.buffer;
            let ignoreRegex = ignorePattern ? new RegExp(ignorePattern) : null;
            for (let i = 0, l = contents.length; i < l; i++) {
                let text = contents[i];
                if (ignoreRegex && ignoreRegex.test(text))
                    continue;
                let ranges = chars.getRanges(text, cword);
                if (ranges.length == 0)
                    continue;
                let obj = new line_1.default(cword, text, i + 1, ranges);
                this.lines.push(obj);
            }
            this.minLnum = lines.length ? lines[0].lnum : 0;
            this.maxLnum = lines.length ? lines[lines.length - 1].lnum : 0;
            this.bufnr = bufnr;
            this.activted = true;
            this.state = 'navigate';
            yield this.nvim.command('let g:rename_activted = 1');
            // TODO may need change params
            yield buffer.request('nvim_buf_attach', [buffer, false, {}]);
            yield this.nvim.call('clearmatches', []);
        });
    }
    stop() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.activted)
                return;
            this.activted = false;
            let { buffer, srcId } = this;
            this.buffer = this.chars = null;
            yield buffer.clearHighlight({ srcId });
            this.lines = [];
            this.activted = false;
            // TODO may need change params
            yield buffer.request('nvim_buf_detach', [buffer]);
            yield this.nvim.command('let g:rename_activted = 0');
        });
    }
    checkPosition(lnum, col) {
        let line = this.lines.find(l => l.lnum == lnum);
        if (!line)
            return false;
        let r = line.getRange(col);
        if (r == null || !r.active)
            return false;
        return true;
    }
    selectAll() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { srcId, buffer } = this;
            for (let line of this.lines) {
                let { ranges, lnum } = line;
                for (let r of ranges) {
                    r.active = true;
                    yield this.addHighlight(lnum, r.start, r.start + r.len);
                }
            }
        });
    }
    // goto next
    nextItem() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { maxLnum, lines, nvim, state } = this;
            let [_, lnum, col] = yield this.nvim.call('getcurpos');
            let r = null;
            for (let i = 0, l = lines.length; i < l; i++) {
                let line = lines[i];
                if (line.lnum == lnum) {
                    r = line.getNextRange(col);
                    if (r) {
                        yield this.gotoRange(lnum, r);
                        return;
                    }
                }
                if (line.lnum > lnum) {
                    r = line.firstRange;
                    if (r) {
                        yield this.gotoRange(line.lnum, r);
                        return;
                    }
                }
            }
            yield index_1.echoWarning(this.nvim, 'hit BOTTOM, continuing at TOP');
            yield this.navigateFirst();
        });
    }
    // goto prev
    prevItem() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { maxLnum, lines, nvim } = this;
            let [_, lnum, col] = yield this.nvim.call('getcurpos');
            let r = null;
            for (let i = lines.length - 1; i >= 0; i--) {
                let line = lines[i];
                if (line.lnum == lnum) {
                    r = line.getPrevRange(col);
                    if (r) {
                        yield this.gotoRange(line.lnum, r);
                        return;
                    }
                }
                if (line.lnum < lnum) {
                    r = line.lastRange;
                    if (r) {
                        yield this.gotoRange(line.lnum, r);
                        return;
                    }
                }
            }
            yield index_1.echoWarning(this.nvim, 'hit TOP, continuing at Bottom');
            yield this.navigateLast();
        });
    }
    // goto first active item
    navigateFirst(isRedirect) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim, lines, state } = this;
            let pos = yield this.nvim.call('getcurpos');
            for (let line of lines) {
                let r = line.firstActive;
                if (r) {
                    if (!isRedirect && line.lnum === pos[1] && r.start + 1 === pos[2]) {
                        yield this.navigateLast(true);
                        break;
                    }
                    else {
                        yield nvim.call('cursor', [line.lnum, r.start + 1]);
                    }
                    return;
                }
            }
        });
    }
    // goto last active item
    navigateLast(isRedirect) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim, lines, state } = this;
            let pos = yield this.nvim.call('getcurpos');
            for (let i = lines.length - 1; i >= 0; i--) {
                let line = lines[i];
                let r = line.lastActive;
                if (r) {
                    if (!isRedirect && line.lnum === pos[1] && r.start + 1 === pos[2]) {
                        yield this.navigateFirst(true);
                    }
                    else {
                        yield nvim.call('cursor', [line.lnum, r.start + 1]);
                    }
                    return;
                }
            }
        });
    }
    toggleActive(lnum, col) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { state, lines, srcId, buffer } = this;
            let line = this.lines.find(o => o.lnum == lnum);
            if (!line)
                return;
            let r = line.getRange(col);
            if (!r)
                return;
            yield buffer.clearHighlight({
                srcId,
                lineStart: lnum - 1,
                lineEnd: lnum,
                async: false
            });
            let { ranges } = line;
            for (let range of ranges) {
                let active = (range.active && r !== range) || (!r.active && range === r);
                range.active = active;
                if (active) {
                    yield this.addHighlight(lnum, range.start, range.start + range.len);
                }
            }
            for (let line of lines) {
                if (line.firstActive != null)
                    return;
            }
            yield this.stop();
        });
    }
    onCharInsert(ch) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.activted)
                return;
            if (this.chars.isKeywordChar(ch)) {
                return;
            }
            yield this.stop();
        });
    }
    gotoRange(lnum, range) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim } = this;
            yield nvim.call('cursor', [lnum, range.start + 1]);
        });
    }
    getWordAhead(content, col) {
        let { chars } = this;
        let buf = global.Buffer.from(content, 'utf8');
        let str = buf.slice(0, col).toString();
        let res = '';
        for (let i = str.length - 1; i >= 0; i--) {
            if (chars.isKeywordChar(str[i])) {
                res = str[i] + res;
            }
            else {
                break;
            }
        }
        return res;
    }
}
exports.default = Manager;
//# sourceMappingURL=manager.js.map