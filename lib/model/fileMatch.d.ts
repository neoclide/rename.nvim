import { Buffer } from 'neovim';
import { Match, MatchInfo, Line, LineChange } from '../types';
export default class FileMatch {
    readonly startLnum: number;
    titleLine?: string;
    filePath: string;
    lines: string[];
    matches: MatchInfo[];
    inserted: boolean;
    /**
     * constructor
     *
     * @public
     * @param {string} file - relative file path
     * @param {number} lnum - line number for file title
     * @returns {undefined}
     */
    constructor(file: string, lnum: number);
    addLine(content: string, matches?: Match[]): void;
    appendTo(buffer: Buffer): Promise<void>;
    applyChanges(changes: LineChange[]): void;
    readonly matchedLines: Line[];
    readonly lineCount: number;
    readonly matchCount: number;
}
