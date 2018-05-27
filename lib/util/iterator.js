"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ArrayIterator {
    constructor(items, start = 0, end = items.length) {
        this.items = items;
        this.start = start;
        this.end = end;
        this.index = start - 1;
    }
    first() {
        this.index = this.start;
        return this.current();
    }
    previous() {
        this.index = this.index - 1;
        return this.current();
    }
    last() {
        this.index = this.end - 1;
        return this.current();
    }
    next() {
        this.index = Math.min(this.index + 1, this.end);
        return this.current();
    }
    current() {
        if (this.index === this.start - 1 || this.index === this.end) {
            return null;
        }
        return this.items[this.index];
    }
}
exports.ArrayIterator = ArrayIterator;
//# sourceMappingURL=iterator.js.map