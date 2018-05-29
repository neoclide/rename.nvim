// umask is blacklisted by node-client
process.umask = ()=> {
  return 18
}
import { Plugin, Function, Neovim } from 'neovim'
import Manager from './manager'
import {StartOption} from './types'
const logger = require('./util/logger')('index')

@Plugin({dev: false})
export default class RenamePlugin {
  public nvim: Neovim
  public manager: Manager

  constructor(nvim: Neovim) {
    this.nvim = nvim
    this.manager = new Manager(nvim)
  }

  @Function('RenameStart', {sync: true})
  public async renameStart(args:any):Promise<void> {
    let opts = args[0] as StartOption
    await this.manager.start(opts)
  }

  @Function('RenameToggle', {sync: true})
  public async renameToggle(args:any):Promise<void> {
    let pos = await this.nvim.call('getcurpos')
    await this.manager.toggleActive(pos[1], pos[2])
  }

  @Function('RenameNext', {sync: false})
  public async renameNext():Promise<void> {
    await this.manager.nextItem()
  }

  @Function('RenamePrev', {sync: false})
  public async renamePrev():Promise<void> {
    await this.manager.prevItem()
  }

  @Function('RenameBegin', {sync: false})
  public async renameEdge():Promise<void> {
    await this.manager.navigateFirst()
  }

  @Function('RenameEnd', {sync: false})
  public async renameEnd():Promise<void> {
    await this.manager.navigateLast()
  }

  @Function('RenameCancel', {sync: false})
  public async renameCancel(args:any[]):Promise<void> {
    let bufnr = args.length ? Number(args[0]) : await this.nvim.call('bufnr', ['%'])
    if (bufnr === this.manager.bufnr) {
      await this.manager.stop()
    }
  }

  @Function('RenameCharInsert', {sync: false})
  public async reanmeCharInsert(args:any[]):Promise<void> {
    let {manager} = this
    await manager.onCharInsert(args[0])
  }
}
