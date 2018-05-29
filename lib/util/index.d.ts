import { Neovim } from 'neovim';
export declare function group<T>(list: T[], max: number): T[][];
export declare function escapeSingleQuote(str: string): string;
export declare function echoErr(nvim: Neovim, line: string): Promise<void>;
export declare function echoWarning(nvim: Neovim, line: string): Promise<void>;
export declare function byteLength(str: string): number;
export declare function byteIndex(content: string, index: number): number;
export declare function debounce(fn: Function, t: number): Function;
export declare function diffString(f: string[], t: string[]): [string, string];
