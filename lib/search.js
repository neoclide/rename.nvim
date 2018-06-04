"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const events_1 = require("events");
const util_1 = require("./util");
const string_1 = require("./util/string");
const array_1 = require("./util/array");
const fs_1 = require("./util/fs");
const cp = require("child_process");
const spinners_1 = require("./util/spinners");
const ansiparse_1 = require("./util/ansiparse");
const fileMatch_1 = require("./model/fileMatch");
const readline = require("readline");
const pify = require("pify");
const fs = require("fs");
const path = require("path");
const logger = require('./util/logger')('search');
class Search extends events_1.EventEmitter {
    constructor(nvim, command, args, cwd, iskeyword) {
        super();
        this.nvim = nvim;
        this.command = command;
        this.args = args;
        this.cwd = cwd;
        this.iskeyword = iskeyword;
        this.lineCount = 0;
        this.running = false;
        this.files = [];
    }
    get matchCount() {
        return this.files.reduce((c, f) => {
            return c + f.matchCount;
        }, 0);
    }
    get matches() {
        return this.files.reduce((c, f) => {
            return c.concat(f.matches);
        }, []);
    }
    get file() {
        let len = this.files.length;
        return this.files[len - 1];
    }
    start() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim, command } = this;
            let args = array_1.flat(this.args.slice());
            let pos = yield nvim.getVar('rename_search_winpos');
            let cmd = this.getOpenCommand(pos);
            let filename = '__rename_search__';
            yield nvim.command(`${cmd} ${filename}`);
            let bufnr = this.bufnr = yield nvim.call('bufnr', ['%']);
            this.vimCwd = yield nvim.call('getcwd');
            let buffer = this.buffer = yield nvim.buffer;
            yield buffer.append(['']);
            this.lineCount = 2;
            let t = command.endsWith('ag') ? 'ag' : 'rg';
            this.wordSearch = args.findIndex(s => s == '--word-regexp') !== -1;
            this.argString = args.join(' ');
            yield this.setStatusLine();
            if (t == 'rg') {
                args.push('-n', '--heading', '--color', 'always', '--colors', 'match:fg:red');
            }
            else {
                // make it red
                args.push('--heading', '--color', '--color-match', '1;31');
            }
            let child = this.child = cp.spawn(command, args, { cwd: this.cwd });
            this.startTs = Date.now();
            this.running = true;
            yield this.spin();
            const rl = readline.createInterface({
                input: child.stdout
            });
            child.on('error', err => {
                this.running = false;
                util_1.echoErr(nvim, err.message).catch(err => { }); // tslint:disable-line
            });
            child.stderr.on('data', data => {
                let str = `Error: ${data.toString().replace(/\n/g, ' ')}`;
                this.lineCount += 1;
                buffer.append(str).catch(err => {
                    logger.error(err.message);
                });
            });
            child.stdout.on('end', this.onEnd.bind(this));
            rl.on('line', this.onLine.bind(this));
            child.on('exit', this.onExit.bind(this));
        });
    }
    onEnd(line) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { buffer, nvim, bufnr, file, wordSearch, iskeyword, interval } = this;
            if (!file.inserted)
                yield file.appendTo(buffer);
            if (interval) {
                clearInterval(interval);
                yield buffer.setLines(this.matchLine, {
                    start: 0,
                    end: 1,
                    strictIndexing: true
                });
            }
            yield nvim.call('setbufvar', [bufnr, '&mod', 0]);
            let nr = yield this.nvim.call('bufnr', ['%']);
            if (nr == bufnr) {
                let file = this.files[0];
                if (!file)
                    return;
                let [_, lnum, col] = yield nvim.call('getcurpos');
                if (lnum == 1 && col == 1) {
                    let m = file.matches[0];
                    if (!m)
                        return;
                    yield this.nvim.call('cursor', [m.lnum, m.start + 1]);
                    // start replace
                    if (wordSearch) {
                        let cword = yield this.nvim.call('expand', ['<cword>']);
                        yield this.nvim.call('RenameStart', [{
                                cword,
                                iskeyword,
                                includePattern: '^\\d+:'
                            }]);
                    }
                }
            }
        });
    }
    onLine(line) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            line = line.toString();
            let { lineCount, file, files, buffer, bufnr } = this;
            let arr = ansiparse_1.default(line);
            let str = arr.map(o => o.text).join('');
            line = this.convertLine(str);
            let { content, lineType } = line;
            if (lineType == 4 /* Unknown */)
                return;
            if (lineType != 0 /* Path */ && !file) {
                logger.error('File not found');
                return;
            }
            switch (lineType) {
                case 0 /* Path */: {
                    let file = new fileMatch_1.default(content, lineCount + 1);
                    files.push(file);
                    break;
                }
                case 1 /* Content */: {
                    let matches = this.getMatches(arr);
                    file.addLine(content, matches);
                    break;
                }
                case 2 /* Seperator */: {
                    file.addLine(content);
                    break;
                }
                case 3 /* Empty */: {
                    file.addLine('');
                    if (!file.inserted) {
                        this.lineCount = lineCount + file.lineCount;
                        yield file.appendTo(buffer);
                    }
                }
            }
        });
    }
    onExit(code) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { command } = this;
            this.running = false;
            if (code)
                logger.info(`${command} exited with code: ${code}`);
        });
    }
    setStatusLine() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim, command, argString } = this;
            let str = `${command} ${argString}`;
            str = str.replace(/\\/g, '\\\\')
                .replace(/\s/g, '\\ ')
                .replace(/"/g, '\\"');
            yield nvim.command(`setl statusline=%m\\ ${str}\\ %=%-P`);
        });
    }
    stop(force) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { child, running } = this;
            let signal = force ? 'SIGKILL' : 'SIGHUP';
            if (running && !child.killed)
                child.kill(signal);
        });
    }
    spin() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim, bufnr } = this;
            let style = yield nvim.getVar('rename_spinner_type');
            let config = spinners_1.default[style];
            if (!config)
                config = spinners_1.default.bouncingBall;
            let { interval, frames } = config;
            let len = frames.length;
            let frameIndex = 0;
            let draw = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                let { buffer, running } = this;
                let text = running ? frames[frameIndex] + ' ' : '';
                yield buffer.setLines(`${text}${this.matchLine}`, {
                    start: 0,
                    end: 1,
                    strictIndexing: true
                });
                frameIndex++;
                if (frameIndex === len)
                    frameIndex = 0;
                if (!running)
                    clearInterval(this.interval);
            });
            this.interval = setInterval(draw, interval);
        });
    }
    convertLine(line) {
        if (/^--$/.test(line)) {
            return {
                content: '....',
                lineType: 2 /* Seperator */
            };
        }
        if (/^\s*$/.test(line)) {
            return {
                content: '',
                lineType: 3 /* Empty */
            };
        }
        if (/^\d+[-:].*$/.test(line)) {
            return {
                content: line,
                lineType: 1 /* Content */
            };
        }
        let { cwd, vimCwd } = this;
        let p = path.join(cwd, line);
        if (!fs.existsSync(p)) {
            logger.error(`unknown line: ${line}`);
            return { content: '', lineType: 4 /* Unknown */ };
        }
        return { content: path.relative(vimCwd, p), lineType: 0 /* Path */ };
    }
    get matchLine() {
        let { matchCount, files } = this;
        let fileCount = files.length;
        if (matchCount == 0)
            return 'No resultes';
        let ts = Date.now() - this.startTs;
        return `Files:${fileCount}   Matches:${matchCount}   Time:${ts}ms`;
    }
    getOpenCommand(pos) {
        switch (pos) {
            case 'right':
                return 'keepalt belowright vs';
            case 'left':
                return 'keepalt vs';
            case 'bottom':
                return 'keepalt below sp';
            case 'top':
                return 'keepalt sp';
            default:
                return 'e';
        }
    }
    // get matched cols
    getMatches(arr) {
        let res = [];
        let bl = 0;
        for (let item of arr) {
            let { text, foreground } = item;
            if (foreground === 'red') {
                res.push([bl, bl + string_1.byteLength(text)]);
            }
            bl += string_1.byteLength(text);
        }
        return res;
    }
    getNextPosition(linenr, col) {
        let { matches } = this;
        let idx = 0;
        for (let m of matches) {
            idx += 1;
            let { lnum, start } = m;
            if (lnum < linenr || (linenr == lnum && col >= start))
                continue;
            return [lnum, start, idx, matches.length];
        }
        let m = matches[0];
        return [m.lnum, m.start, 1, matches.length];
    }
    getPrevPosition(linenr, col) {
        let { matches } = this;
        let len = matches.length;
        for (let i = len - 1; i >= 0; i--) {
            let p = matches[i];
            let { lnum, end } = p;
            if (lnum > linenr || (linenr == lnum && col <= end))
                continue;
            return [lnum, p.start, i + 1, len];
        }
        let m = matches[len - 1];
        return [m.lnum, m.start, len, len];
    }
    writeFiles() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim, bufnr, buffer } = this;
            let mod = yield buffer.getOption('mod');
            // not changed
            if (!mod)
                return;
            let changes = yield this.getChanges();
            if (!changes)
                return;
            let changedFiles = Object.keys(changes);
            let count = changedFiles.length;
            if (!count) {
                yield util_1.echoMessage(nvim, 'No file have been changed.');
                yield nvim.call('setbufvar', [bufnr, '&mod', 0]);
                return;
            }
            let save = yield nvim.call('rename#prompt_change', [count]);
            if (save) {
                let cwd = yield buffer.getVar('search_cwd');
                for (let f of changedFiles) {
                    let filePath = path.join(cwd, f);
                    try {
                        let stat = yield pify(fs.stat)(filePath);
                    }
                    catch (e) {
                        yield util_1.echoErr(nvim, `File ${filePath} not found!`);
                        continue;
                    }
                    let file = this.files.find(o => o.filePath == f);
                    if (file) {
                        file.applyChanges(changes[f]);
                    }
                    else {
                        logger.error(`file not found ${f}`);
                    }
                }
                yield Promise.all(changedFiles.map(f => {
                    let filePath = path.join(cwd, f);
                    return fs_1.applyChanges(filePath, changes[f]);
                }));
                yield nvim.call('setbufvar', [bufnr, '&mod', 0]);
                yield nvim.command('checktime');
            }
        });
    }
    getChanges() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { buffer, nvim, files } = this;
            let newLines = yield buffer.lines;
            let changes = {};
            let newFiles = {};
            let currFile = null;
            let filePaths = files.map(o => o.filePath);
            let lnum = 1;
            for (let line of newLines) {
                if (/^\$.+:/.test(line)) {
                    let ms = line.match(/^\$(.+):/);
                    currFile = ms[1];
                    if (filePaths.indexOf(currFile) === -1) {
                        let f = files.find(o => o.startLnum == lnum);
                        if (f) {
                            currFile = f.filePath;
                            // fix invalid change
                            yield nvim.call('setline', [lnum, f.titleLine]);
                        }
                        else {
                            yield util_1.echoErr(nvim, `File ${currFile} not found!`);
                            return;
                        }
                    }
                    newFiles[currFile] = {};
                }
                if (currFile && /^\d+:/.test(line)) {
                    let ms = line.match(/^(\d+):(.*)$/);
                    newFiles[currFile][ms[1]] = ms[2];
                }
                lnum += 1;
            }
            for (let f of Object.keys(newFiles)) {
                let file = this.files.find(o => o.filePath == f);
                let origLines = file.matchedLines;
                let newContents = newFiles[f];
                let arr = this.getLineChanges(origLines, newContents);
                if (arr.length) {
                    changes[f] = arr;
                }
            }
            return changes;
        });
    }
    getLineChanges(origLines, newContents) {
        let res = [];
        for (let [lnum, text] of origLines) {
            let newText = newContents[lnum];
            if (newText != text) {
                res.push({
                    changeType: 1 /* Update */,
                    content: newText,
                    lnum
                });
            }
        }
        return res;
    }
}
exports.default = Search;
//# sourceMappingURL=search.js.map