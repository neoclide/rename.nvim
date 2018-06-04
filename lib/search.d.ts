/// <reference types="node" />
import { Neovim } from 'neovim';
import { EventEmitter } from 'events';
import { MatchInfo, LineChange } from './types';
import FileMatch from './model/fileMatch';
export interface Changes {
    [index: string]: LineChange[];
}
export default class Search extends EventEmitter {
    private nvim;
    command: string;
    args: string[][];
    cwd: string;
    iskeyword: string;
    bufnr: number;
    vimCwd: string;
    private buffer;
    private interval;
    private child;
    private running;
    private argString;
    private startTs;
    private files;
    private lineCount;
    private wordSearch;
    constructor(nvim: Neovim, command: string, args: string[][], cwd: string, iskeyword: string);
    readonly matchCount: number;
    readonly matches: MatchInfo[];
    readonly file: FileMatch;
    start(): Promise<void>;
    private onEnd(line);
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
    writeFiles(): Promise<void>;
    private getChanges();
    private getLineChanges(origLines, newContents);
}
