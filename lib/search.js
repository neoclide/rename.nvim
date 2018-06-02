"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const events_1 = require("events");
const util_1 = require("./util");
const string_1 = require("./util/string");
const array_1 = require("./util/array");
const cp = require("child_process");
const spinners_1 = require("./util/spinners");
const ansiparse_1 = require("./util/ansiparse");
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const logger = require('./util/logger')('search');
class Search extends events_1.EventEmitter {
    constructor(nvim, command, args, cwd) {
        super();
        this.nvim = nvim;
        this.command = command;
        this.args = args;
        this.cwd = cwd;
        this.fileCount = 0;
        this.matchCount = 0;
        this.running = false;
        this.positions = [];
        this.lines = [];
    }
    get length() {
        return this.lines.length;
    }
    start() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim, command, positions } = this;
            let args = array_1.flat(this.args.slice());
            let pos = yield nvim.getVar('rename_search_winpos');
            let cmd = this.getOpenCommand(pos);
            let filename = '__rename_search__';
            yield nvim.command(`${cmd} ${filename}`);
            this.bufnr = yield nvim.call('bufnr', ['%']);
            this.vimCwd = yield nvim.call('getcwd');
            let buffer = this.buffer = yield nvim.buffer;
            yield buffer.append(['']);
            this.lines.push('', '');
            let t = command.endsWith('ag') ? 'ag' : 'rg';
            this.argString = args.join(' ');
            yield this.setStatusLine();
            if (t == 'rg') {
                args.push('-n', '--heading', '--color', 'always', '--colors', 'match:fg:red');
            }
            else {
                // make it red
                args.push('--heading', '--color', '--color-match', '1;31');
            }
            yield this.spin();
            let child = this.child = cp.spawn(command, args, { cwd: this.cwd });
            this.startTs = Date.now();
            this.running = true;
            const rl = readline.createInterface({
                input: child.stdout
            });
            child.on('error', err => {
                this.running = false;
                util_1.echoErr(nvim, err.message).catch(err => { }); // tslint:disable-line
            });
            child.stderr.on('data', data => {
                let str = `Error: ${data.toString().replace(/\n/g, ' ')}`;
                this.lines.push(str);
                buffer.append(str).catch(err => {
                    logger.error(err.message);
                });
            });
            rl.on('line', this.onLine.bind(this));
            child.on('exit', this.onExit.bind(this));
        });
    }
    onLine(line) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            line = line.toString();
            let { length, buffer, positions, bufnr } = this;
            let lnum = length;
            let arr = ansiparse_1.default(line);
            let str = arr.map(o => o.text).join('');
            // \033[1;33m24=\033[K-
            line = this.convertLine(str);
            this.lines.push(line);
            yield buffer.append(line);
            // match line
            if (/^\d+:/.test(line)) {
                let matches = this.getMatches(arr);
                if (matches.length) {
                    let jump = this.matchCount == 0;
                    this.matchCount = this.matchCount + matches.length;
                    yield Promise.all(matches.map(m => {
                        positions.push({ lnum, startCol: m[0], endCol: m[1] });
                        return buffer.addHighlight({
                            srcId: 0,
                            hlGroup: 'renameSearchMatch',
                            line: lnum,
                            colStart: m[0],
                            colEnd: m[1],
                            async: true
                        });
                    }));
                    if (jump) {
                        let nr = yield this.nvim.call('bufnr', ['%']);
                        if (nr == bufnr) {
                            let m = matches[0];
                            yield this.nvim.call('cursor', [lnum + 1, m[0] + 1]);
                        }
                    }
                }
            }
        });
    }
    onExit(code) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { command, buffer } = this;
            this.running = false;
            if (code) {
                logger.info(`${command} exited with code: ${code}`);
            }
            yield this.stop(false);
        });
    }
    setStatusLine() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { nvim, command, argString, cwd } = this;
            let str = `${command} ${argString}`;
            str = str.replace(/\\/g, '\\\\')
                .replace(/\s/g, '\\ ')
                .replace(/"/g, '\\"');
            yield nvim.command(`setl statusline=\\ ${str}`);
        });
    }
    stop(force) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { interval, child, buffer, running, fileCount } = this;
            let signal = force ? 'SIGKILL' : 'SIGHUP';
            if (running && !child.killed)
                child.kill(signal);
        });
    }
    spin() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { buffer, nvim } = this;
            let style = yield nvim.getVar('rename_spinner_type');
            let config = spinners_1.default[style];
            if (!config)
                config = spinners_1.default.bouncingBall;
            let { interval, frames } = config;
            let len = frames.length;
            let frameIndex = 0;
            let draw = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                let { buffer, running, interval } = this;
                let text = running ? frames[frameIndex] + ' ' : '';
                yield buffer.setLines(`${text}${this.matchLine}`, {
                    start: 0,
                    end: 1,
                    strictIndexing: true
                });
                frameIndex++;
                if (frameIndex === len)
                    frameIndex = 0;
                if (!running) {
                    clearInterval(this.interval);
                }
            });
            this.interval = setInterval(draw, interval);
        });
    }
    convertLine(line) {
        if (/^--$/.test(line))
            return '....';
        if (/^\s*$/.test(line))
            return '';
        let ms = line.match(/^\d+[-:].*$/);
        if (ms)
            return line;
        let { cwd, vimCwd } = this;
        let p = path.join(cwd, line);
        if (!fs.existsSync(p)) {
            logger.error(`unknown line: ${line}`);
            return '';
        }
        this.fileCount = this.fileCount + 1;
        return `${path.relative(vimCwd, p)}:`;
    }
    get matchLine() {
        let { matchCount, fileCount } = this;
        if (matchCount == 0)
            return 'No resultes';
        let ts = Date.now() - this.startTs;
        return `Files:${fileCount}   Matches:${matchCount}   Time:${ts}ms`;
    }
    getOpenCommand(pos) {
        switch (pos) {
            case 'right':
                return 'belowright vs';
            case 'left':
                return 'vs';
            case 'bottom':
                return 'below sp';
            case 'top':
                return 'sp';
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
        let { positions } = this;
        let idx = 0;
        for (let p of positions) {
            idx += 1;
            let { lnum, startCol } = p;
            if (lnum < linenr || (linenr == lnum && col >= startCol))
                continue;
            return [p.lnum, p.startCol, idx, positions.length];
        }
        let p = positions[0];
        return [p.lnum, p.startCol, 1, positions.length];
    }
    getPrevPosition(linenr, col) {
        let { positions } = this;
        let len = positions.length;
        for (let i = len - 1; i >= 0; i--) {
            let p = positions[i];
            let { lnum, endCol } = p;
            if (lnum > linenr || (linenr == lnum && col <= endCol))
                continue;
            return [p.lnum, p.startCol, i + 1, positions.length];
        }
        let p = positions[len - 1];
        return [p.lnum, p.startCol, len, len];
        return null;
    }
}
exports.default = Search;
//# sourceMappingURL=search.js.map