import { Neovim } from 'neovim';
export declare function escapeSingleQuote(str: string): string;
export declare function echoErr(nvim: Neovim, line: string): Promise<void>;
export declare function echoWarning(nvim: Neovim, line: string): Promise<void>;
export declare function echoMessage(nvim: Neovim, line: string): Promise<void>;
export declare function debounce(fn: Function, t: number): Function;
export declare function findVcsRoot(dir: string): string | null;
