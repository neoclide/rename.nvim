import { Neovim } from 'neovim';
import Manager from './manager';
export default class RenamePlugin {
    nvim: Neovim;
    manager: Manager;
    private searches;
    constructor(nvim: Neovim);
    renameStart(args: any): Promise<void>;
    renameToggle(args: any): Promise<void>;
    renameNext(): Promise<void>;
    renamePrev(): Promise<void>;
    renameEdge(): Promise<void>;
    renameEnd(): Promise<void>;
    renameCancel(args: any[]): Promise<void>;
    renameCharInsert(args: any[]): Promise<void>;
    renameSearch(args: any[]): Promise<void>;
    renameSearchCompleteFunc(args: [string, string, number]): Promise<string[]>;
    renameBufferUnload(args: [number]): Promise<void>;
    renameSearchAction(args: any[]): Promise<void>;
    private stopSearch(force);
    private getSearch();
    private openFile(openType);
    private onMove(moveType);
}
