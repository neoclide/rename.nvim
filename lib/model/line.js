"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const iterator_1 = require("../util/iterator");
const string_1 = require("../util/string");
const logger = require('../util/logger')('model-line');
class Line {
    constructor(word, content, lnum, ranges) {
        this.word = word;
        this.content = content;
        this.ranges = ranges;
        this.lnum = lnum;
    }
    /**
     * Set a new word to current line
     *
     * @public
     * @param {string} word
     * @returns {void}
     */
    setNewWord(word) {
        let { content, ranges, lnum } = this;
        ranges = ranges.filter(r => r.active);
        if (!ranges.length)
            return;
        let origLen = ranges[0].len;
        let newLine = '';
        let iterator = new iterator_1.ArrayIterator(ranges);
        let curr = iterator.next();
        let newLen = string_1.byteLength(word);
        let idx = 0;
        for (let i = 0, l = content.length; i < l; i++) {
            let b = string_1.byteIndex(content, i);
            if (curr && b === curr.start) {
                curr.start = b + (newLen - origLen) * idx;
                curr.len = newLen;
                newLine = newLine + word;
                curr = iterator.next();
                i = i + origLen - 1;
                idx = idx + 1;
            }
            else {
                newLine = newLine + content[i];
            }
        }
        // end of line
        if (curr && curr.start == string_1.byteLength(content)) {
            curr.start = string_1.byteLength(newLine);
            curr.len = newLen;
            newLine = newLine + word;
        }
        this.word = word;
        this.content = newLine;
    }
    getRange(col) {
        let idx = col - 1;
        for (let r of this.ranges) {
            if (idx >= r.start && idx < r.start + r.len) {
                return r;
            }
        }
        return null;
    }
    resetRanges() {
        this.ranges = this.ranges.filter(r => {
            return r.active;
        });
    }
    getNextRange(col) {
        let { ranges } = this;
        let idx = col - 1;
        for (let i = 0; i < ranges.length; i++) {
            let r = ranges[i];
            if (idx >= r.start && idx < r.start + r.len) {
                return ranges[i + 1];
            }
        }
        return null;
    }
    getPrevRange(col) {
        let { ranges } = this;
        let idx = col - 1;
        for (let i = 0; i < ranges.length; i++) {
            let r = ranges[i];
            if (idx >= r.start && idx < r.start + r.len) {
                return ranges[i - 1];
            }
        }
        return null;
    }
    get firstRange() {
        return this.ranges[0];
    }
    get lastRange() {
        let { ranges } = this;
        return ranges[ranges.length - 1];
    }
    get firstActive() {
        return this.ranges.find(o => o.active);
    }
    get lastActive() {
        let list = this.ranges.filter(r => r.active);
        return list[list.length - 1];
    }
    get activeRanges() {
        return this.ranges.filter(r => r.active);
    }
}
exports.default = Line;
//# sourceMappingURL=line.js.map