"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const logger = require('./logger')('util-index');
function group(list, max) {
    let res = [];
    let arr = [];
    for (let i = 0, l = list.length; i < l; i++) {
        if (arr.length === max) {
            res.push(arr);
            arr = [];
        }
        arr.push(list[i]);
    }
    if (arr.length) {
        res.push(arr);
    }
    return res;
}
exports.group = group;
function echoMsg(nvim, line, hl) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            yield nvim.command(`echohl ${hl} | echomsg '[rename] ${escapeSingleQuote(line)}' | echohl None"`);
        }
        catch (e) {
            logger.error(e.stack);
        }
        return;
    });
}
function escapeSingleQuote(str) {
    return str.replace(/'/g, "''");
}
exports.escapeSingleQuote = escapeSingleQuote;
function echoErr(nvim, line) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return yield echoMsg(nvim, line, 'Error');
    });
}
exports.echoErr = echoErr;
function echoWarning(nvim, line) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return yield echoMsg(nvim, line, 'WarningMsg');
    });
}
exports.echoWarning = echoWarning;
// nvim use utf8
function byteLength(str) {
    let buf = Buffer.from(str, 'utf8');
    return buf.length;
}
exports.byteLength = byteLength;
function byteIndex(content, index) {
    let s = content.slice(0, index);
    return byteLength(s);
}
exports.byteIndex = byteIndex;
function diffString(f, t) {
    let af = f.slice();
    let at = t.slice();
    let minLen = Math.min(af.length, at.length);
    for (let i = 0; i < minLen; i++) {
        if (af[0] == at[0]) {
            af.shift();
            at.shift();
        }
        else {
            break;
        }
    }
    minLen = Math.min(af.length, at.length);
    for (let i = 0; i < minLen; i++) {
        if (af[af.length - 1] == at[at.length - 1]) {
            af.pop();
            at.pop();
        }
        else {
            break;
        }
    }
    return [af.join(''), at.join('')];
}
exports.diffString = diffString;
//# sourceMappingURL=index.js.map