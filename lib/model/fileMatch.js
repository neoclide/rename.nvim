"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const logger = require('../util/logger')('model-filematch');
class FileMatch {
    /**
     * constructor
     *
     * @public
     * @param {string} file - relative file path
     * @param {number} lnum - line number for file title
     * @returns {undefined}
     */
    constructor(file, lnum) {
        this.inserted = false;
        this.startLnum = lnum;
        this.filePath = file;
        this.lines = [];
        this.matches = [];
    }
    addLine(content, matches) {
        let { startLnum } = this;
        this.lines.push(content);
        let lnum = startLnum + this.lines.length;
        if (!matches)
            return;
        for (let m of matches) {
            this.matches.push({
                lnum,
                start: m[0],
                end: m[1]
            });
        }
    }
    appendTo(buffer) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let insert = [];
            let { filePath, lines, matches, inserted } = this;
            if (inserted)
                return;
            this.inserted = true;
            let titleLine = this.titleLine = `$${filePath}: (${matches.length} matches)`;
            insert.push(titleLine);
            insert = insert.concat(lines);
            yield buffer.append(insert);
            yield Promise.all(matches.map(m => {
                return buffer.addHighlight({
                    srcId: 0,
                    hlGroup: 'renameSearchMatch',
                    line: m.lnum - 1,
                    colStart: m.start,
                    colEnd: m.end,
                    async: true
                });
            }));
        });
    }
    applyChanges(changes) {
        let { lines, filePath } = this;
        for (let c of changes) {
            let { lnum, changeType, content } = c;
            let s = `${lnum}:`;
            let idx = lines.findIndex(c => c.startsWith(s));
            if (idx !== -1) {
                lines[idx] = `${lnum}:${content}`;
            }
            else {
                logger.error(`${lnum} of ${filePath} not found`);
            }
        }
    }
    get matchedLines() {
        let lines = [];
        for (let str of this.lines) {
            if (/^\d+:/.test(str)) {
                let ms = str.match(/^(\d+):(.*)$/);
                lines.push([Number(ms[1]), ms[2]]);
            }
        }
        return lines;
    }
    get lineCount() {
        return this.lines.length + 1;
    }
    get matchCount() {
        return this.matches.length;
    }
}
exports.default = FileMatch;
//# sourceMappingURL=fileMatch.js.map