"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function flat(arr) {
    let res = [];
    for (let item of arr) {
        res.push.apply(res, item);
    }
    return res;
}
exports.flat = flat;
//# sourceMappingURL=array.js.map