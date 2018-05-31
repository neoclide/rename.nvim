import {Neovim, Buffer} from 'neovim'
import {EventEmitter} from 'events'
import {
  SpinConfig,
  SearchInfo,
  Position,
  MatchItem,
  Match
} from './types'
import {
  findLiteralMathces,
  findRegExMatches,
  byteLength,
} from './util/string'
import {
  flat
} from './util/array'
import * as cp from 'child_process'
import spinData from './util/spinners'
import ansiparse from './util/ansiparse'
import readline = require('readline')
import fs = require('fs')
import path = require('path')
const logger = require('./util/logger')('search')

export default class Search extends EventEmitter {
  public bufnr:number
  public vimCwd:string
  private buffer:Buffer
  private interval:NodeJS.Timer
  private child:cp.ChildProcess
  private running:boolean
  private fileCount = 0
  private matchCount = 0
  private argString:string
  private positions:Position[]
  private lines:string[]
  constructor(
    private nvim: Neovim,
    public command: string,
    public args: string[][],
    public cwd: string
  ) {
    super()
    this.running = false
    this.positions = []
    this.lines = []
  }

  public get length():number {
    return this.lines.length
  }

  public async start(): Promise<void> {
    let {nvim, command, positions} = this
    let args = flat(this.args.slice())
    let pos = await nvim.getVar('rename_search_winpos')
    let cmd = this.getOpenCommand(pos as string)
    let filename = '__rename_search__'
    await nvim.command(`${cmd} ${filename}`)
    this.bufnr = await nvim.call('bufnr', ['%'])
    this.vimCwd = await nvim.call('getcwd')
    let buffer = this.buffer = await nvim.buffer
    await buffer.append([''])
    this.lines.push('', '')
    await this.spin()
    await this.setStatusLine('')
    let t = command.endsWith('ag') ? 'ag' : 'rg'
    this.argString = args.join(' ')
    if (t == 'rg') {
      args.push('-n', '--heading', '--color', 'always', '--colors', 'match:fg:red')
    } else {
      // make it red
      args.push('--heading', '--color', '--color-match', '1;31')
    }
    let child = this.child = cp.spawn(command, args, { cwd: this.cwd })
    this.running = true
    const rl = readline.createInterface({
      input: child.stdout
    })
    child.stderr.on('data', data => {
      let str = `Error: ${data.toString().replace(/\n/g, ' ')}`
      this.lines.push(str)
      buffer.append(str).catch(err => {
        logger.error(err.message)
      })
    })
    rl.on('line', this.onLine.bind(this))
    child.on('exit', this.onExit.bind(this))
  }

  private async onLine(line):Promise<void> {
    line = line.toString()
    let {length, buffer, positions, bufnr} = this
    let lnum = length
    let arr = ansiparse(line)
    let str = arr.map(o => o.text).join('')
    // \033[1;33m24=\033[K-
    line = this.convertLine(str)
    this.lines.push(line)
    await buffer.append(line)
    // match line
    if (/^\d+:/.test(line)) {
      let matches = this.getMatches(arr)
      if (matches.length) {
        let jump = this.matchCount == 0
        this.matchCount = this.matchCount + matches.length
        await buffer.setLines(this.matchLine, {
          start: 0,
          end: 1,
          strictIndexing: true
        })
        await Promise.all(matches.map(m => {
          positions.push({lnum, startCol:m[0], endCol:m[1]})
          return buffer.addHighlight({
            srcId: 0,
            hlGroup: 'renameSearchMatch',
            line: lnum,
            colStart: m[0],
            colEnd: m[1],
            async: true
          })
        }))
        if (jump) {
          let nr = await this.nvim.call('bufnr', ['%'])
          if (nr == bufnr) {
            let m = matches[0]
            await this.nvim.call('cursor', [lnum + 1, m[0] + 1])
          }
        }
      }
    }
  }

  private async onExit(code):Promise<void> {
    let {command, buffer} = this
    this.running = false
    if (code) {
      logger.info(`${command} exited with code: ${code}`)
    }
    try {
      await buffer.setLines(this.matchLine, {
        start: 0,
        end: 1,
        strictIndexing: true
      })
      await this.setStatusLine('')
      await this.stop(false)
    } catch (e) {
      logger.error(e.message)
    }
  }

  public async setStatusLine(spin:string):Promise<void> {
    let {nvim, command, argString, cwd} = this
    let str = `${command} ${argString}`
    str = str.replace(/\\/g, '\\\\')
          .replace(/\s/g, '\\ ')
          .replace(/"/g, '\\"')
    spin = spin.replace(/\s/g, '\\ ')
    await nvim.command(`setl statusline=${spin}\\ ${str}`)
  }

  public async stop(force:boolean):Promise<void> {
    let {interval, child, buffer, running, fileCount} = this
    let signal = force ? 'SIGKILL' : 'SIGHUP'
    if (running && !child.killed) child.kill(signal)
    clearInterval(interval)
  }

  private async spin():Promise<void> {
    let {buffer, nvim} = this
    let style = await nvim.getVar('rename_spinner_type')
    let config = spinData[style as string]
    if (!config) config = spinData.bouncingBall
    let {interval, frames} = config
    let len = frames.length
    let frameIndex = 0
    let draw = (first:boolean):void => {
      let {buffer, running} = this
      if ((!running && !first) || !buffer) return
      let text = frames[frameIndex]
      this.setStatusLine(text).catch(err => {
        logger.error(err.message)
      })
      frameIndex ++
      if (frameIndex === len) {
        frameIndex = 0
      }
    }
    this.interval = setInterval(draw, interval)
  }

  private convertLine(line:string):string {
    if (/^--$/.test(line)) return '....'
    if (/^\s*$/.test(line)) return ''
    let ms = line.match(/^\d+[-:].*$/)
    if (ms) return line
    let {cwd, vimCwd} = this
    let p = path.join(cwd, line)
    if (!fs.existsSync(p)) {
      logger.error(`unknown line: ${line}`)
      return ''
    }
    this.fileCount = this.fileCount + 1
    return `${path.relative(vimCwd, p)}:`
  }

  private get matchLine():string {
    let {matchCount, fileCount} = this
    if (matchCount == 0) return 'No resultes'
    return `${matchCount} matches across ${fileCount} files`
  }

  private getOpenCommand(pos:string):string {
    switch (pos) {
      case 'right':
        return 'belowright vs'
      case 'left':
        return 'vs'
      case 'bottom':
        return 'below sp'
      case 'top':
        return 'sp'
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
    let {positions} = this
    let idx = 0
    for (let p of positions) {
      idx += 1
      let {lnum, startCol} = p
      if (lnum < linenr || (linenr == lnum && col >= startCol)) continue
      return [p.lnum, p.startCol, idx, positions.length]
    }
    let p = positions[0]
    return [p.lnum, p.startCol, 1, positions.length]
  }

  public getPrevPosition(linenr:number, col:number):[number, number, number, number]|null {
    let {positions} = this
    let len = positions.length
    for (let i = len - 1; i >= 0 ; i --) {
      let p = positions[i]
      let {lnum, endCol} = p
      if (lnum > linenr || (linenr == lnum && col <= endCol)) continue
      return [p.lnum, p.startCol, i + 1, positions.length]
    }
    let p = positions[len - 1]
    return [p.lnum, p.startCol, len, len]
    return null
  }
}
