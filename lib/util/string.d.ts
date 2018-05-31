import { Match } from '../types';
export declare function byteLength(str: string): number;
export declare function byteIndex(content: string, index: number): number;
export declare function diffString(f: string[], t: string[]): [string, string];
export declare function findLiteralMathces(base: string, match: string): Match[];
export declare function findRegExMatches(base: string, regex: RegExp): Match[];
