export declare type State = 'navigate' | 'edit';
export interface PositionItem {
    lnum: number;
    rangeIdx: number;
}
export interface StartOption {
    content: string;
    lnum: number;
    col: number;
    cword: string;
    bufnr: number;
    iskeyword: string;
    ignorePattern?: string;
}
export interface DiffItem {
    0: number;
    1: string;
}
export interface Range {
    start: number;
    len: number;
    active: boolean;
}
export interface Cols {
    start: number;
    end: number;
}
