import { Neovim } from 'neovim';
import Manager from './manager';
export default class RenamePlugin {
    nvim: Neovim;
    manager: Manager;
    constructor(nvim: Neovim);
    renameStart(args: any): Promise<void>;
    renameToggle(args: any): Promise<void>;
    renameNext(): Promise<void>;
    renamePrev(): Promise<void>;
    renameEdge(): Promise<void>;
    renameEnd(): Promise<void>;
    renameCancel(args: any[]): Promise<void>;
    reanmeCharInsert(args: any[]): Promise<void>;
}
