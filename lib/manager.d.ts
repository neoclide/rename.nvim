import { Neovim } from 'neovim';
import { StartOption } from './types';
import Line from './model/line';
export default class Manager {
    activted: boolean;
    bufnr: number;
    private changeId;
    private chars;
    private origLines;
    private lines;
    private buffer;
    private readonly nvim;
    private srcId;
    private endLnum;
    private startLnum;
    constructor(nvim: Neovim);
    onLineChange(line: Line, content: string): Promise<void>;
    private addHighlight(lnum, range);
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
    private echoMessage(r);
    private getCountInfo(r);
}
