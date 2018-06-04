export declare type State = 'navigate' | 'edit';
export declare const enum LineType {
    Path = 0,
    Content = 1,
    Seperator = 2,
    Empty = 3,
    Unknown = 4,
}
export interface LineInfo {
    content: string;
    lineType: LineType;
}
export interface MatchInfo {
    lnum: number;
    start: number;
    end: number;
}
export interface PositionItem {
    lnum: number;
    rangeIdx: number;
}
export interface StartOption {
    cword: string;
    iskeyword: string;
    currentOnly?: boolean;
    includePattern?: string;
}
export declare const enum ChangeType {
    Delete = 0,
    Update = 1,
}
export interface LineChange {
    changeType: ChangeType;
    content: string | null;
    lnum: number;
}
export declare type Line = [number, string];
export declare type Match = [number, number];
export interface Range {
    start: number;
    len: number;
    active: boolean;
}
export interface Cols {
    start: number;
    end: number;
}
export interface SpinConfig {
    interval: number;
    frames: string[];
}
export interface SearchInfo {
    searchType: 'literal' | 'word' | 'regex';
    word?: string;
    regexList?: string[];
    literal?: string;
}
export interface MatchItem {
    foreground?: string;
    background?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    text: string;
}
