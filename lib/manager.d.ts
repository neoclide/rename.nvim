import { Neovim } from 'neovim';
import { State, StartOption } from './types';
import Line from './model/line';
export default class Manager {
    activted: boolean;
    state: State;
    bufnr: number;
    private chars;
    private lines;
    private buffer;
    private readonly nvim;
    private srcId;
    private maxLnum;
    private minLnum;
    private lastChangeTs;
    constructor(nvim: Neovim);
    onLineChange(line: Line, content: string): Promise<void>;
    private addHighlight(lnum, start, end);
    start(opts: StartOption): Promise<void>;
    stop(): Promise<void>;
    checkPosition(lnum: number, col: number): boolean;
    selectAll(): Promise<void>;
    nextItem(): Promise<void>;
    prevItem(): Promise<void>;
    navigateFirst(isRedirect?: boolean): Promise<void>;
    navigateLast(isRedirect?: boolean): Promise<void>;
    toggleActive(lnum: number, col: number): Promise<void>;
    onCharInsert(ch: any): Promise<void>;
    private gotoRange(lnum, range);
    private getWordAhead(content, col);
}
