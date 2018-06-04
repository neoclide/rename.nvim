// umask is blacklisted by node-client
process.umask = ()=> {
  return 18
}
import { Plugin, Command, Function, Neovim } from 'neovim'
import Manager from './manager'
import {
  StartOption,
} from './types'
import {
  findVcsRoot,
  echoMessage
} from './util/index'
import Search from './search'
import {optionList, convertOptions} from './option'
import path = require('path')
const logger = require('./util/logger')('index')

@Plugin({dev: false})
export default class RenamePlugin {
  public nvim: Neovim
  public manager: Manager
  private searches:Search[]

  constructor(nvim: Neovim) {
    this.nvim = nvim
    this.manager = new Manager(nvim)
    this.searches = []
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

  @Function('RenameCancel', {sync: true})
  public async renameCancel(args:any[]):Promise<void> {
    let bufnr = args.length ? Number(args[0]) : await this.nvim.call('bufnr', ['%'])
    if (bufnr === this.manager.bufnr) {
      await this.manager.stop()
    }
  }

  @Function('RenameCharInsert', {sync: false})
  public async renameCharInsert(args:any[]):Promise<void> {
    let {manager} = this
    await manager.onCharInsert(args[0])
  }

  @Command('RenameSearch', {
    nargs: '+',
    sync: true,
    complete: 'customlist,RenameSearchCompleteFunc'
  })
  public async renameSearch(args:any[]):Promise<void> {
    let {nvim} = this
    let exe:string = await nvim.call('rename#get_execute')
    if (!exe) return
    let cmd = exe.endsWith('ag') ? 'ag' : 'rg'
    let extraArgs = await nvim.getVar('rename_search_extra_args')
    if (Array.isArray(extraArgs) && extraArgs.length) {
      args = extraArgs.concat(args)
    }
    let opts = convertOptions(args, cmd)
    let useVcs = await nvim.getVar('rename_search_vcs_root')
    let cwd = await nvim.call('getcwd')
    let buffer = await nvim.buffer
    let iskeyword = await buffer.getOption('iskeyword')
    if (useVcs) {
      let full_path = await nvim.call('rename#get_fullpath')
      let dir = full_path ? path.dirname(full_path) : cwd
      dir = findVcsRoot(dir)
      if (dir) cwd = dir
    }
    let search = new Search(nvim, cmd, opts, cwd, iskeyword as string)
    await search.start()
    this.searches.push(search)
  }

  @Function('RenameSearchCompleteFunc', {sync: true})
  public async renameSearchCompleteFunc(args:[string, string, number]):Promise<string[]> {
    let lead = args[0]
    return optionList.filter(s => s.indexOf(lead) === 0)
  }

  @Function('RenameBufferUnload', {sync: true})
  public async renameBufferUnload(args:[number]):Promise<void> {
    let bufnr = args[0]
    let search = this.searches.find(o => o.bufnr == bufnr)
    if (search) {
      await search.stop(true)
      let idx = this.searches.findIndex(o => o === search)
      this.searches.splice(idx, 1)
    }
  }

  @Function('RenameSearchWrite', {sync: true})
  public async renameSearchWrite(args:[number]):Promise<void> {
    let bufnr = args[0]
    let {nvim} = this
    let search = this.searches.find(o => o.bufnr == bufnr)
    await nvim.command('doautocmd BufWrite,BufWritePre')
    if (search) {
      await search.writeFiles()
    }
    await nvim.command('doautocmd BufWritePost')
  }

  @Function('RenameSearchAction', {sync: true})
  public async renameSearchAction(args:any[]):Promise<void> {
    let [action, ...opts] = args
    switch (action) {
      case 'stop':
        await this.stopSearch(opts[0] == '!')
        break
      case 'open':
        await this.openFile(opts[0])
        break
      case 'move':
        await this.onMove(opts[0])
        break
      default:
        logger.debug('not implementated')
    }
  }

  private async stopSearch(force:boolean):Promise<void> {
    let search = await this.getSearch()
    if (search) await search.stop(force)
  }

  private async getSearch():Promise<Search|null> {
    let bufnr = await this.nvim.call('bufnr', ['%'])
    let search = this.searches.find(o => o.bufnr == bufnr)
    return search
  }

  private async openFile(cmd):Promise<void> {
    let {nvim} = this
    let line = await nvim.call('getline', ['.'])
    if (!/\d+[-:]/.test(line)) return
    let lnum = Number(line.match(/(\d+)[-:]/)[1])
    let search = await this.getSearch()
    if (!search) return
    let filepath = await nvim.call('rename#get_filepath')
    if (!filepath) return
    let cwd = await nvim.call('getcwd')
    let orig_cwd = await nvim.eval('b:search_cwd')
    let fullpath = path.join(orig_cwd as string, filepath)
    let file = path.relative(cwd, fullpath)
    await nvim.command(`${cmd} +${lnum} ${file}`)
  }

  private async onMove(moveType:string):Promise<void> {
    let search = await this.getSearch()
    if (!search) return
    let p = await this.nvim.call('getcurpos')
    let lnum = p[1]
    let col = p[2]
    let arr
    switch (moveType) {
      case 'prev':
        arr = search.getPrevPosition(lnum, col)
        break
      case 'next':
        arr = search.getNextPosition(lnum, col)
        break
    }
    if (arr) {
      let [lnum, col, index, len] = arr
      await this.nvim.call('cursor', [lnum, col + 1])
      await echoMessage(this.nvim, `matches ${index} of ${len}`)
    }
  }
}
