import {Neovim, Buffer} from 'neovim'
import {EventEmitter} from 'events'
import {
  LineInfo,
  LineType,
  MatchItem,
  MatchInfo,
  LineChange,
  ChangeType,
  Match,
  Line,
} from './types'
import {
  echoMessage,
  echoErr
} from './util'
import {
  byteLength,
} from './util/string'
import {
  flat
} from './util/array'
import {applyChanges} from './util/fs'
import * as cp from 'child_process'
import spinData from './util/spinners'
import ansiparse from './util/ansiparse'
import FileMatch from './model/fileMatch'
import readline = require('readline')
import pify = require('pify')
import fs = require('fs')
import path = require('path')
const logger = require('./util/logger')('search')

export interface Changes {
  [index:string]:LineChange[]
}

export default class Search extends EventEmitter {
  public bufnr:number
  public vimCwd:string
  private buffer:Buffer
  private interval:NodeJS.Timer
  private child:cp.ChildProcess
  private running:boolean
  private argString:string
  private startTs:number|null
  private files:FileMatch[]
  private lineCount = 0
  private wordSearch:boolean
  constructor(
    private nvim: Neovim,
    public command: string,
    public args: string[][],
    public cwd: string,
    public iskeyword: string
  ) {
    super()
    this.running = false
    this.files = []
  }

  public get matchCount():number {
    return this.files.reduce((c, f) => {
      return c + f.matchCount
    }, 0)
  }

  public get matches():MatchInfo[] {
    return this.files.reduce((c, f) => {
      return c.concat(f.matches)
    }, [])
  }

  public get file():FileMatch {
    let len = this.files.length
    return this.files[len - 1]
  }

  public async start(): Promise<void> {
    let {nvim, command} = this
    let args = flat(this.args.slice())
    let pos = await nvim.getVar('rename_search_winpos')
    let cmd = this.getOpenCommand(pos as string)
    let filename = '__rename_search__'
    await nvim.command(`${cmd} ${filename}`)
    let bufnr = this.bufnr = await nvim.call('bufnr', ['%'])
    this.vimCwd = await nvim.call('getcwd')
    let buffer = this.buffer = await nvim.buffer
    await buffer.append([''])
    this.lineCount = 2
    let t = command.endsWith('ag') ? 'ag' : 'rg'
    this.wordSearch = args.findIndex(s => s == '--word-regexp') !== -1
    this.argString = args.join(' ')
    await this.setStatusLine()
    if (t == 'rg') {
      args.push('-n', '--heading', '--color', 'always', '--colors', 'match:fg:red')
    } else {
      // make it red
      args.push('--heading', '--color', '--color-match', '1;31')
    }
    let child = this.child = cp.spawn(command, args, { cwd: this.cwd })
    this.startTs = Date.now()
    this.running = true
    await this.spin()
    const rl = readline.createInterface({
      input: child.stdout
    })
    child.on('error', err => {
      this.running = false
      echoErr(nvim, err.message).catch(err => { }) // tslint:disable-line
    })
    child.stderr.on('data', data => {
      let str = `Error: ${data.toString().replace(/\n/g, ' ')}`
      this.lineCount += 1
      buffer.append(str).catch(err => {
        logger.error(err.message)
      })
    })
    child.stdout.on('end', this.onEnd.bind(this))
    rl.on('line', this.onLine.bind(this))
    child.on('exit', this.onExit.bind(this))
  }

  private async onEnd(line):Promise<void> {
    let {buffer, nvim, bufnr, file, wordSearch, iskeyword, interval} = this
    if (!file.inserted) await file.appendTo(buffer)
    if (interval) {
      clearInterval(interval)
      await buffer.setLines(this.matchLine, {
        start: 0,
        end: 1,
        strictIndexing: true
      })
    }
    await nvim.call('setbufvar', [bufnr, '&mod', 0])
    let nr = await this.nvim.call('bufnr', ['%'])
    if (nr == bufnr) {
      let file = this.files[0]
      if (!file) return
      let [_, lnum, col] = await nvim.call('getcurpos')
      if (lnum == 1 && col == 1) {
        let m = file.matches[0]
        if (!m) return
        await this.nvim.call('cursor', [m.lnum, m.start + 1])
        // start replace
        if (wordSearch) {
          let cword = await this.nvim.call('expand', ['<cword>'])
          await this.nvim.call('RenameStart', [{
            cword,
            iskeyword,
            includePattern: '^\\d+:'
          }])
        }
      }
    }
  }

  private async onLine(line):Promise<void> {
    line = line.toString()
    let { lineCount, file, files, buffer, bufnr} = this
    let arr = ansiparse(line)
    let str = arr.map(o => o.text).join('')
    line = this.convertLine(str)
    let {content, lineType} = line
    if (lineType == LineType.Unknown) return
    if (lineType != LineType.Path && !file) {
      logger.error('File not found')
      return
    }
    switch (lineType) {
      case LineType.Path: {
        let file = new FileMatch(content, lineCount + 1)
        files.push(file)
        break
      }
      case LineType.Content: {
        let matches = this.getMatches(arr)
        file.addLine(content, matches)
        break
      }
      case LineType.Seperator: {
        file.addLine(content)
        break
      }
      case LineType.Empty: {
        file.addLine('')
        if (!file.inserted) {
          this.lineCount = lineCount + file.lineCount
          await file.appendTo(buffer)
        }
      }
    }
  }

  private async onExit(code):Promise<void> {
    let {command} = this
    this.running = false
    if (code) logger.info(`${command} exited with code: ${code}`)
  }

  public async setStatusLine():Promise<void> {
    let {nvim, command, argString} = this
    let str = `${command} ${argString}`
    str = str.replace(/\\/g, '\\\\')
          .replace(/\s/g, '\\ ')
          .replace(/"/g, '\\"')
    await nvim.command(`setl statusline=%m\\ ${str}\\ %=%-P`)
  }

  public async stop(force:boolean):Promise<void> {
    let {child, running} = this
    let signal = force ? 'SIGKILL' : 'SIGHUP'
    if (running && !child.killed) child.kill(signal)
  }

  private async spin():Promise<void> {
    let {nvim, bufnr} = this
    let style = await nvim.getVar('rename_spinner_type')
    let config = spinData[style as string]
    if (!config) config = spinData.bouncingBall
    let {interval, frames} = config
    let len = frames.length
    let frameIndex = 0
    let draw = async () => {
      let {buffer, running} = this
      let text = running ? frames[frameIndex] + ' ' : ''
      await buffer.setLines(`${text}${this.matchLine}`, {
        start: 0,
        end: 1,
        strictIndexing: true
      })
      frameIndex ++
      if (frameIndex === len) frameIndex = 0
      if (!running) clearInterval(this.interval)
    }
    this.interval = setInterval(draw, interval)
  }

  private convertLine(line:string):LineInfo {
    if (/^--$/.test(line)) {
      return {
        content: '....',
        lineType: LineType.Seperator
      }
    }
    if (/^\s*$/.test(line)) {
      return {
        content: '',
        lineType: LineType.Empty
      }
    }
    if (/^\d+[-:].*$/.test(line)) {
      return {
        content: line,
        lineType: LineType.Content
      }
    }
    let {cwd, vimCwd} = this
    let p = path.join(cwd, line)
    if (!fs.existsSync(p)) {
      logger.error(`unknown line: ${line}`)
      return {content: '', lineType: LineType.Unknown}
    }
    return {content:path.relative(vimCwd, p), lineType:LineType.Path}
  }

  private get matchLine():string {
    let {matchCount, files} = this
    let fileCount = files.length
    if (matchCount == 0) return 'No resultes'
    let ts = Date.now() - this.startTs
    return `Files:${fileCount}   Matches:${matchCount}   Time:${ts}ms`
  }

  private getOpenCommand(pos:string):string {
    switch (pos) {
      case 'right':
        return 'keepalt belowright vs'
      case 'left':
        return 'keepalt vs'
      case 'bottom':
        return 'keepalt below sp'
      case 'top':
        return 'keepalt sp'
      default:
        return 'e'
    }
  }

  // get matched cols
  private getMatches(arr:MatchItem[]):Match[] {
    let res:Match[] = []
    let bl = 0
    for (let item of arr) {
      let {text, foreground} = item
      if (foreground === 'red') {
        res.push([bl, bl + byteLength(text)])
      }
      bl += byteLength(text)
    }
    return res
  }

  public getNextPosition(linenr:number, col:number):[number, number, number, number]|null {
    let {matches} = this
    let idx = 0
    for (let m of matches) {
      idx += 1
      let {lnum, start} = m
      if (lnum < linenr || (linenr == lnum && col >= start)) continue
      return [lnum, start, idx, matches.length]
    }
    let m = matches[0]
    return [m.lnum, m.start, 1, matches.length]
  }

  public getPrevPosition(linenr:number, col:number):[number, number, number, number]|null {
    let {matches} = this
    let len = matches.length
    for (let i = len - 1; i >= 0 ; i --) {
      let p = matches[i]
      let {lnum, end} = p
      if (lnum > linenr || (linenr == lnum && col <= end)) continue
      return [lnum, p.start, i + 1, len]
    }
    let m = matches[len - 1]
    return [m.lnum, m.start, len, len]
  }

  public async writeFiles():Promise<void> {
    let {nvim, bufnr, buffer} = this
    let mod = await buffer.getOption('mod')
    // not changed
    if (!mod) return
    let changes = await this.getChanges()
    if (!changes) return
    let changedFiles = Object.keys(changes)
    let count = changedFiles.length
    if (!count) {
      await echoMessage(nvim, 'No file have been changed.')
      await nvim.call('setbufvar', [bufnr, '&mod', 0])
      return
    }
    let save = await nvim.call('rename#prompt_change', [count])
    if (save) {
      let cwd = await buffer.getVar('search_cwd')
      for (let f of changedFiles) {
        let filePath = path.join(cwd as string, f)
        try {
          let stat = await pify(fs.stat)(filePath)
        } catch (e) {
          await echoErr(nvim, `File ${filePath} not found!`)
          continue
        }
        let file = this.files.find(o => o.filePath == f)
        if (file) {
          file.applyChanges(changes[f])
        } else {
          logger.error(`file not found ${f}`)
        }
      }
      await Promise.all(changedFiles.map(f => {
        let filePath = path.join(cwd as string, f)
        return applyChanges(filePath, changes[f])
      }))
      await nvim.call('setbufvar', [bufnr, '&mod', 0])
      await nvim.command('checktime')
    }
  }

  private async getChanges():Promise<Changes|null> {
    let {buffer, nvim, files} = this
    let newLines = await buffer.lines
    let changes:Changes = {}
    let newFiles = {}
    let currFile = null
    let filePaths = files.map(o => o.filePath)
    let lnum = 1
    for (let line of newLines) {
      if (/^\$.+:/.test(line)) {
        let ms = line.match(/^\$(.+):/)
        currFile = ms[1]
        if (filePaths.indexOf(currFile) === -1) {
          let f = files.find(o => o.startLnum == lnum)
          if (f) {
            currFile = f.filePath
            // fix invalid change
            await nvim.call('setline', [lnum, f.titleLine])
          } else {
            await echoErr(nvim, `File ${currFile} not found!`)
            return
          }
        }
        newFiles[currFile] = {}
      }
      if (currFile && /^\d+:/.test(line)) {
        let ms = line.match(/^(\d+):(.*)$/)
        newFiles[currFile][ms[1]] = ms[2]
      }
      lnum += 1
    }
    for (let f of Object.keys(newFiles)) {
      let file = this.files.find(o => o.filePath == f)
      let origLines = file.matchedLines
      let newContents = newFiles[f]
      let arr = this.getLineChanges(origLines, newContents)
      if (arr.length) {
        changes[f] = arr
      }
    }
    return changes
  }

  private getLineChanges(origLines:Line[], newContents:{[index:number]:string}):LineChange[] {
    let res:LineChange[] = []
    for (let [lnum, text] of origLines) {
      let newText = newContents[lnum]
      if (newText != text) {
        res.push({
          changeType: ChangeType.Update,
          content: newText,
          lnum
        })
      }
    }
    return res
  }
}
