import { Range } from '../types';
export declare class CharRange {
    start: number;
    end: number;
    constructor(start: number, end?: number);
    static fromKeywordOption(keywordOption: string): CharRange[];
    contains(c: number): boolean;
}
export declare class Chars {
    ranges: CharRange[];
    constructor(keywordOption: string);
    addKeyword(ch: string): void;
    splitString(str: string): string[];
    setKeywordOption(keywordOption: string): void;
    getRanges(line: string, word: string): Range[];
    isKeywordChar(ch: string): boolean;
    isKeyword(word: string): boolean;
}
