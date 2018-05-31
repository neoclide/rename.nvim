"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = require("fs");
const path = require("path");
const logger = require('./logger')('util-index');
const vsc_folderss = ['.git', '.hg', '.svn', '.bzr', '_darcs'];
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
function echoMessage(nvim, line) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return yield echoMsg(nvim, line, 'MoreMsg');
    });
}
exports.echoMessage = echoMessage;
function debounce(fn, t) {
    let last = null;
    let timeout = null;
    let cb = (...args) => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        let ts = Date.now();
        if (!last || ts - last > t) {
            last = ts;
            fn.apply(null, args);
        }
        else {
            timeout = setTimeout(cb.apply(null, args), t + 10);
        }
    };
    return cb;
}
exports.debounce = debounce;
function findVcsRoot(dir) {
    let { root } = path.parse(dir);
    let p = null;
    while (dir != root) {
        for (let n of vsc_folderss) {
            if (fs.existsSync(path.join(dir, n))) {
                p = dir;
                break;
            }
        }
        dir = path.dirname(dir);
    }
    return p;
}
exports.findVcsRoot = findVcsRoot;
//# sourceMappingURL=index.js.map