"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const pify = require("pify");
const fs = require("fs");
const detectNewline = require("detect-newline");
function applyChanges(fullpath, changes) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        let content = yield pify(fs.readFile)(fullpath, 'utf8');
        let sep = detectNewline(content);
        let lines = content.split(sep);
        for (let c of changes) {
            let { changeType, content, lnum } = c;
            if (changeType == 1 /* Update */) {
                lines[lnum - 1] = content;
            }
        }
        lines = lines.filter(l => l != null);
        yield pify(fs.writeFile)(fullpath, lines.join(sep), 'utf8');
        return true;
    });
}
exports.applyChanges = applyChanges;
//# sourceMappingURL=fs.js.map