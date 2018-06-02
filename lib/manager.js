"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const line_1 = require("./model/line");
const chars_1 = require("./model/chars");
const index_1 = require("./util/index");
const string_1 = require("./util/string");
const debounce = require("debounce");
const logger = require('./util/logger')('manager');
function getChangeId(lines, start, end) {
    if (lines.length != end - start)
        return null;
    if (lines.length == 0)
        return null;
    if (lines.length == 1)
        return lines[0];
    return `${start}-${end}`;
}
class Manager {
    constructor(nvim) {
        this.activted = false;
        this.nvim = nvim;
        this.srcId = 9527;
        this.changing = false;
        const delay = 100;
        let callback = debounce((line, content) => {
            this.onLineChange(line, content).catch(e => {
                logger.error(e.stack);
            });
        }, delay, false);
        nvim.on('notification', (name, args) => {
            if (!this.activted)
                return;
            if (name === 'nvim_buf_lines_event') {
                let [buf, tick, firstline, lastline, linedata, more] = args;
                if (!this.buffer.equals(buf))
                    return;
                // change from set lines or undo/redo
                let { changeId } = this;
                if (changeId && changeId == getChangeId(linedata, firstline, lastline)) {
                    // this.changeId = null
                    return;
                }
                let line = this.lines.find(o => o.lnum == firstline + 1);
                if (!line
                    || lastline - firstline != 1
                    || linedata.length != 1) {
                    callback.clear();
                    index_1.echoWarning(nvim, 'Unexpected line change detected').catch(() => { }); // tslint:disable-line
                    this.stop().catch(err => {
                        logger.error(err.stack);
                    });
                    return;
                }
                callback(line, linedata[0]);
            }
        });
    }
    onLineChange(line, content) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { lines, chars, srcId, startLnum, nvim, endLnum, activted, buffer } = this;
            if (!activted)
                return;
            let [_, lnum, col] = yield nvim.call('getcurpos', []);
            let mode = yield nvim.call('mode', []);
            let currWord = this.getWordAhead(content, mode == 'i' ? col - 1 : col);
            let af = chars.splitString(line.content);
            let at = chars.splitString(content);
            let [replacedWord, newWord] = string_1.diffString(af, at);
            if (replacedWord != line.word || lnum != line.lnum) {
                yield index_1.echoWarning(nvim, 'Other word get changed');
                yield this.stop();
                return;
            }
            let dc = string_1.byteLength(newWord) - string_1.byteLength(replacedWord);
            let end = mode == 'i' ? col - currWord.length - 1 : col - currWord.length;
            let pl = line.activeRanges.filter(r => (r.start + r.len) < end).length;
            let newLines = this.origLines.slice();
            let hls = [];
            for (let line of this.lines) {
                line.setNewWord(newWord);
                line.resetRanges();
                let { activeRanges, lnum, content } = line;
                newLines[lnum - startLnum] = content;
                hls = hls.concat(activeRanges.map(r => {
                    return { lnum, range: r };
                }));
            }
            this.changing = true;
            this.changeId = getChangeId(newLines, startLnum - 1, endLnum);
            try {
                yield buffer.setLines(newLines, {
                    start: startLnum - 1,
                    end: endLnum,
                    strictIndexing: true
                });
            }
            catch (e) {
                this.changing = false;
                // user typing
                if (/Vim:E523/.test(e.message)) {
                    return;
                }
                logger.error(e.message);
            }
            // fix cursor position
            if (pl) {
                col = col + pl * dc;
                yield nvim.call('cursor', [lnum, col]);
            }
            yield buffer.clearHighlight({ srcId });
            yield Promise.all(hls.map(o => {
                return this.addHighlight(o.lnum, o.range);
            }));
            this.changing = false;
        });
    }
    addHighlight(lnum, range) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { start, len } = range;
            let { buffer, srcId } = this;
            range.active = true;
            let end = start + len;
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
            let { cword, iskeyword, currentOnly, includePattern } = opts;
            if (activted || !cword)
                return;
            let buffer = this.buffer = yield nvim.buffer;
            let contents = yield buffer.lines;
            let [_, lnum, col] = yield nvim.call('getcurpos', []);
            let chars = this.chars = new chars_1.Chars(iskeyword);
            let lines = this.lines = [];
            let lineRe = includePattern ? new RegExp(includePattern) : null;
            let range = null;
            for (let i = 0, l = contents.length; i < l; i++) {
                let text = contents[i];
                if (lineRe && !lineRe.test(text))
                    continue;
                let ranges = chars.getRanges(text, cword);
                if (ranges.length == 0)
                    continue;
                let obj = new line_1.default(cword, text, i + 1, ranges);
                if (i + 1 == lnum) {
                    range = obj.getRange(col);
                }
                this.lines.push(obj);
            }
            if (lines.length == 0)
                return;
            this.bufnr = yield nvim.call('bufnr', ['%']);
            this.startLnum = lines[0].lnum;
            this.endLnum = lines[lines.length - 1].lnum;
            this.origLines = contents.slice(this.startLnum - 1, this.endLnum - 1);
            // TODO the API could change
            yield buffer.request('nvim_buf_attach', [buffer, false, {}]);
            // await this.nvim.call('clearmatches', [])
            if (currentOnly) {
                if (range) {
                    yield this.addHighlight(lnum, range);
                }
            }
            else {
                yield this.selectAll();
                if (range)
                    yield this.echoMessage(range);
            }
            yield nvim.call('rename#setup_autocmd');
            this.activted = true;
            yield this.nvim.command('let g:rename_activted = 1');
        });
    }
    stop() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.activted)
                return;
            this.activted = false;
            let { buffer, srcId } = this;
            this.buffer = this.origLines = this.lines = this.chars = null;
            yield buffer.clearHighlight({ srcId });
            this.lines = [];
            this.activted = false;
            // TODO API could change
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
                    yield this.addHighlight(lnum, r);
                }
            }
        });
    }
    // goto next
    nextItem() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { endLnum, lines, nvim } = this;
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
            let { endLnum, lines, nvim } = this;
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
            let { nvim, lines } = this;
            let pos = yield this.nvim.call('getcurpos');
            for (let line of lines) {
                let r = line.firstActive;
                if (r) {
                    if (!isRedirect && line.lnum === pos[1] && r.start + 1 === pos[2]) {
                        yield this.navigateLast(true);
                        break;
                    }
                    else {
                        yield this.gotoRange(line.lnum, r);
                    }
                    return;
                }
            }
        });
    }
    // goto last active item
    navigateLast(isRedirect) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim, lines } = this;
            let pos = yield this.nvim.call('getcurpos');
            for (let i = lines.length - 1; i >= 0; i--) {
                let line = lines[i];
                let r = line.lastActive;
                if (r) {
                    if (!isRedirect && line.lnum === pos[1] && r.start + 1 === pos[2]) {
                        yield this.navigateFirst(true);
                    }
                    else {
                        yield this.gotoRange(line.lnum, r);
                    }
                    return;
                }
            }
        });
    }
    toggleActive(lnum, col) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { lines, srcId, buffer } = this;
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
                    yield this.addHighlight(lnum, range);
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
            yield this.addHighlight(lnum, range);
            yield nvim.call('cursor', [lnum, range.start + 1]);
            yield this.echoMessage(range);
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
    echoMessage(r) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim } = this;
            let info = this.getCountInfo(r);
            if (!info)
                return;
            let [i, total] = info;
            let { word } = this.lines[0];
            yield index_1.echoMessage(nvim, `/\\<${word}\\> match ${i} of ${total}`);
        });
    }
    getCountInfo(r) {
        let i = 0;
        let total = 0;
        let found = false;
        if (!r.active)
            return null;
        for (let line of this.lines) {
            let { activeRanges } = line;
            total += activeRanges.length;
            if (!found) {
                for (let item of activeRanges) {
                    i = i + 1;
                    if (item === r) {
                        found = true;
                        break;
                    }
                }
            }
        }
        if (!found)
            return null;
        return [i, total];
    }
}
exports.default = Manager;
//# sourceMappingURL=manager.js.map