"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../util/index");
const logger = require('../util/logger')('model-chars');
class CharRange {
    constructor(start, end) {
        this.start = start;
        this.end = end ? end : start;
    }
    static fromKeywordOption(keywordOption) {
        let parts = keywordOption.split(',');
        let ranges = [];
        for (let part of parts) {
            if (part == '@') {
                // number and letters
                ranges.push(new CharRange(65, 90));
                ranges.push(new CharRange(97, 122));
                ranges.push(new CharRange(192, 255));
            }
            else if (/^\d+-\d+$/.test(part)) {
                let ms = part.match(/^(\d+)-(\d+)$/);
                ranges.push(new CharRange(Number(ms[1]), Number(ms[2])));
            }
            else if (/^\d+$/.test(part)) {
                ranges.push(new CharRange(Number(part)));
            }
            else {
                let c = part.charCodeAt(0);
                if (!ranges.some(o => o.contains(c))) {
                    ranges.push(new CharRange(c));
                }
            }
        }
        return ranges;
    }
    contains(c) {
        return c >= this.start && c <= this.end;
    }
}
exports.CharRange = CharRange;
class Chars {
    constructor(keywordOption) {
        this.ranges = CharRange.fromKeywordOption(keywordOption);
    }
    addKeyword(ch) {
        let c = ch.charCodeAt(0);
        let { ranges } = this;
        if (!ranges.some(o => o.contains(c))) {
            ranges.push(new CharRange(c));
        }
    }
    // split string into word/noneword parts
    splitString(str) {
        let curr = '';
        let keyword = true;
        let res = [];
        for (let c of str) {
            let isKeyword = this.isKeywordChar(c);
            if (isKeyword) {
                if (keyword) {
                    curr += c;
                }
                else {
                    curr = c;
                    keyword = true;
                }
            }
            else {
                if (curr.length)
                    res.push(curr);
                res.push(c);
                keyword = false;
                curr = '';
            }
        }
        if (curr.length)
            res.push(curr);
        return res;
    }
    setKeywordOption(keywordOption) {
        this.ranges = CharRange.fromKeywordOption(keywordOption);
    }
    getRanges(line, word) {
        if (!word.length)
            return [];
        let res = [];
        let f = word[0];
        let len = word.length;
        let blen = index_1.byteLength(word);
        for (let i = 0, l = line.length; i < l; i++) {
            let ch = line[i];
            if (ch === f && line.slice(i, i + len) == word) {
                let b = line[i - 1];
                let e = line[i + len];
                if ((!b || !this.isKeywordChar(b)) && (!e || !this.isKeywordChar(e))) {
                    res.push({
                        start: index_1.byteIndex(line, i),
                        len: blen,
                        active: true
                    });
                }
                i = i + len - 1;
            }
        }
        return res;
    }
    isKeywordChar(ch) {
        let { ranges } = this;
        let c = ch.charCodeAt(0);
        if (c > 255)
            return false;
        return ranges.some(r => r.contains(c));
    }
    isKeyword(word) {
        let { ranges } = this;
        for (let i = 0, l = word.length; i < l; i++) {
            let ch = word.charCodeAt(i);
            // for speed
            if (ch > 255)
                return false;
            if (ranges.some(r => r.contains(ch)))
                continue;
            return false;
        }
        return true;
    }
}
exports.Chars = Chars;
//# sourceMappingURL=chars.js.map