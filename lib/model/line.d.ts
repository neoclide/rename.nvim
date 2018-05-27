import { Range } from '../types';
export default class Line {
    content: string;
    word: string;
    ranges: Range[];
    readonly lnum: number;
    constructor(word: string, content: string, lnum: number, ranges: Range[]);
    /**
     * Set a new word to current line
     *
     * @public
     * @param {string} word
     * @returns {void}
     */
    setNewWord(word: string): void;
    getRange(col: number): Range | null;
    resetRanges(): void;
    getNextRange(col: number): Range | null;
    getPrevRange(col: number): Range | null;
    readonly firstRange: Range;
    readonly lastRange: Range;
    readonly firstActive: Range | null;
    readonly lastActive: Range | null;
    readonly activeRanges: Range[];
}
