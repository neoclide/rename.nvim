"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
function findLiteralMathces(base, match) {
    let res = [];
    let bl = 0;
    let ml = match.length;
    let mbl = byteLength(match);
    for (let i = 0, l = base.length; i < l; i++) {
        let c = base[i];
        if (c == match[0] && base.slice(i, ml) == match) {
            res.push([bl, bl + byteLength(match)]);
            i = i + ml - 1;
            bl = bl + mbl;
            continue;
        }
        bl = bl + byteLength(c);
    }
    return res;
}
exports.findLiteralMathces = findLiteralMathces;
function findRegExMatches(base, regex) {
    let res = [];
    let ms;
    while (ms = regex.exec(base) !== null) { // tslint:disable-line
        let bl = byteLength(ms[0]);
        let s = byteIndex(base, ms.index);
        res.push([s, s + bl]);
    }
    return res;
}
exports.findRegExMatches = findRegExMatches;
//# sourceMappingURL=string.js.map