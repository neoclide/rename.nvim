/// <reference types="node" />
import { Neovim } from 'neovim';
import { EventEmitter } from 'events';
export default class Search extends EventEmitter {
    private nvim;
    command: string;
    args: string[][];
    cwd: string;
    bufnr: number;
    vimCwd: string;
    private buffer;
    private interval;
    private child;
    private running;
    private fileCount;
    private matchCount;
    private argString;
    private startTs;
    private positions;
    private lines;
    constructor(nvim: Neovim, command: string, args: string[][], cwd: string);
    readonly length: number;
    start(): Promise<void>;
    private onLine(line);
    private onExit(code);
    setStatusLine(): Promise<void>;
    stop(force: boolean): Promise<void>;
    private spin();
    private convertLine(line);
    private readonly matchLine;
    private getOpenCommand(pos);
    private getMatches(arr);
    getNextPosition(linenr: number, col: number): [number, number, number, number] | null;
    getPrevPosition(linenr: number, col: number): [number, number, number, number] | null;
}
