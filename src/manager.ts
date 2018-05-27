import {Neovim, Buffer} from 'neovim'
import {State,
  DiffItem,
  StartOption,
  Range,
  PositionItem} from './types'
import Line from './model/line'
import {Chars} from './model/chars'
import {ArrayIterator} from './util/iterator'
import {
  echoWarning,
  echoErr,
  byteIndex,
  byteLength,
  diffString
} from './util/index'

const logger = require('./util/logger')('manager')

export default class Manager {
  public activted:boolean
  public state:State
  public bufnr:number
  private chars:Chars
  private lines:Line[]
  private buffer:Buffer|null
  private readonly nvim:Neovim
  private srcId: number
  private maxLnum:number
  private minLnum:number
  private lastChangeTs:number

  constructor(nvim:Neovim) {
    this.activted = false
    this.nvim = nvim
    this.srcId = 9527
    nvim.on('notification', (name, args) => {
      if (!this.activted) return
      if (name === 'nvim_buf_lines_event') {
        let [buf, tick, firstline, lastline, linedata, more] = args
        let ts = this.lastChangeTs
        let line = this.lines.find(o => o.lnum == firstline + 1)
        if (!this.buffer.equals(buf)) return
        // caused by set lines
        if (ts && Date.now() - ts < 20) return
        if (!line
          || lastline - firstline != 1
          || linedata.length != 1) {
          this.stop().catch(err => {
            // echoErr(nvim, 'Unexpected line change detected').catch(() => { })
          })
          return
        }
        this.onLineChange(line, linedata[0]).catch(e => {
          logger.error(e.stack)
        })
      }
    })
  }

  public async onLineChange(line:Line, content:string):Promise<void> {
    let {lines, chars, srcId, minLnum, nvim, maxLnum, activted, buffer} = this
    if (!activted) return
    let [_, lnum, col] = await nvim.call('getcurpos', [])
    let mode = await nvim.call('mode', [])
    let currWord = this.getWordAhead(content, mode == 'i' ? col - 1 : col)
    let af = chars.splitString(line.content)
    let at = chars.splitString(content)
    let [replacedWord, newWord] = diffString(af, at)
    if (replacedWord != line.word || lnum != line.lnum) {
      await echoWarning(nvim, 'Other word get changed')
      await this.stop()
      return
    }
    let dc = byteLength(newWord) - byteLength(replacedWord)
    let end = mode == 'i' ? col - currWord.length -1 : col - currWord.length
    let pl = line.activeRanges.filter(r => (r.start + r.len) < end).length
    this.state = 'edit'
    let newLines = await buffer.getLines({
      start: minLnum - 1,
      end: maxLnum,
      strictIndexing: false })
    let hls = []
    for (let line of this.lines) {
      line.setNewWord(newWord)
      line.resetRanges()
      let {activeRanges, lnum, content} = line
      newLines[lnum - minLnum] = content
      hls = hls.concat(activeRanges.map(r => {
        return {lnum, start: r.start, end: r.start + r.len}
      }))
    }

    this.lastChangeTs = Date.now()
    await buffer.setLines(newLines, {
      start: minLnum - 1,
      end: maxLnum,
      strictIndexing: false
    })
    // fix cursor position
    if (pl) {
      col = col + pl * dc
      await nvim.call('cursor', [lnum, col])
    }
    await buffer.clearHighlight({srcId})
    await Promise.all(hls.map(o => {
      return this.addHighlight(o.lnum, o.start, o.end)
    }))
  }

  private async addHighlight(lnum:number, start:number, end:number):Promise<void> {
    let {buffer, srcId} = this
    await buffer.addHighlight({
      srcId,
      hlGroup: 'NvimRename',
      line: lnum - 1,
      colStart: start,
      colEnd: end,
      async: true
    })
  }

  public async start(opts:StartOption):Promise<void> {
    let {activted, nvim} = this
    if (activted) return
    let {content, lnum, bufnr, col, cword, iskeyword, ignorePattern} = opts
    let chars = this.chars = new Chars(iskeyword)
    let contents = content.split(/\n/g)
    let lines = this.lines = []
    let buffer = this.buffer = await nvim.buffer
    let ignoreRegex = ignorePattern ? new RegExp(ignorePattern) : null
    for (let i = 0, l = contents.length; i < l; i++) {
      let text = contents[i]
      if (ignoreRegex && ignoreRegex.test(text)) continue
      let ranges = chars.getRanges(text, cword)
      if (ranges.length == 0) continue
      let obj = new Line(cword, text, i + 1, ranges)
      this.lines.push(obj)
    }
    this.minLnum = lines.length ? lines[0].lnum : 0
    this.maxLnum = lines.length ? lines[lines.length - 1].lnum : 0
    this.bufnr = bufnr
    this.activted = true
    this.state = 'navigate'
    await this.nvim.command('let g:rename_activted = 1')
    // TODO may need change params
    await buffer.request('nvim_buf_attach', [buffer, false])
    await this.nvim.call('clearmatches', [])
  }

  public async stop():Promise<void> {
    if (!this.activted) return
    this.activted = false
    let {buffer, srcId} = this
    this.buffer = this.chars = null
    await buffer.clearHighlight({srcId})
    this.lines = []
    this.activted = false
    // TODO may need change params
    await buffer.request('nvim_buf_detach', [buffer])
    await this.nvim.command('let g:rename_activted = 0')
  }

  public checkPosition(lnum:number, col:number):boolean {
    let line = this.lines.find(l => l.lnum == lnum)
    if (!line) return false
    let r = line.getRange(col)
    if (r == null || !r.active) return false
    return true
  }

  public async selectAll():Promise<void> {
    let {srcId, buffer} = this
    for (let line of this.lines) {
      let {ranges, lnum} = line
      for (let r of ranges) {
        r.active = true
        await this.addHighlight(lnum, r.start, r.start + r.len)
      }
    }
  }

  // goto next
  public async nextItem():Promise<void> {
    let {maxLnum, lines, nvim, state} = this
    let [_, lnum, col] = await this.nvim.call('getcurpos')
    let r = null
    for (let i = 0, l = lines.length; i < l; i++) {
      let line = lines[i]
      if (line.lnum == lnum) {
        r = line.getNextRange(col)
        if (r) {
          await this.gotoRange(lnum, r)
          return
        }
      }
      if (line.lnum > lnum) {
        r = line.firstRange
        if (r) {
          await this.gotoRange(line.lnum, r)
          return
        }
      }
    }
    await echoWarning(this.nvim, 'hit BOTTOM, continuing at TOP')
    await this.navigateFirst()
  }

  // goto prev
  public async prevItem():Promise<void> {
    let {maxLnum, lines, nvim} = this
    let [_, lnum, col] = await this.nvim.call('getcurpos')
    let r = null
    for (let i = lines.length - 1; i >= 0; i--) {
      let line = lines[i]
      if (line.lnum == lnum) {
        r = line.getPrevRange(col)
        if (r) {
          await this.gotoRange(line.lnum, r)
          return
        }
      }
      if (line.lnum < lnum) {
        r = line.lastRange
        if (r) {
          await this.gotoRange(line.lnum, r)
          return
        }
      }
    }
    await echoWarning(this.nvim, 'hit TOP, continuing at Bottom')
    await this.navigateLast()
  }

  // goto first active item
  public async navigateFirst(isRedirect?:boolean):Promise<void> {
    let {nvim, lines, state} = this
    let pos = await this.nvim.call('getcurpos')
    for (let line of lines) {
      let r = line.firstActive
      if (r) {
        if (!isRedirect && line.lnum === pos[1] && r.start + 1 === pos[2]) {
          await this.navigateLast(true)
          break
        } else {
          await nvim.call('cursor', [line.lnum, r.start + 1])
        }
        return
      }
    }
  }

  // goto last active item
  public async navigateLast(isRedirect?:boolean):Promise<void> {
    let {nvim, lines, state} = this
    let pos = await this.nvim.call('getcurpos')
    for (let i = lines.length - 1; i >= 0; i--) {
      let line = lines[i]
      let r = line.lastActive
      if (r) {
        if (!isRedirect && line.lnum === pos[1] && r.start + 1 === pos[2]) {
          await this.navigateFirst(true)
        } else {
          await nvim.call('cursor', [line.lnum, r.start + 1])
        }
        return
      }
    }
  }

  public async toggleActive(lnum:number, col:number):Promise<void> {
    let {state, lines, srcId, buffer} = this
    let line = this.lines.find(o => o.lnum == lnum)
    if (!line) return
    let r = line.getRange(col)
    if (!r) return
    await buffer.clearHighlight({
      srcId,
      lineStart: lnum - 1,
      lineEnd: lnum,
      async: false
    })
    let {ranges} = line
    for (let range of ranges) {
      let active = (range.active && r !== range) || (!r.active && range === r)
      range.active = active
      if (active) {
        await this.addHighlight(lnum, range.start, range.start + range.len)
      }
    }
    for (let line of lines) {
      if (line.firstActive != null) return
    }
    await this.stop()
  }

  public async onCharInsert(ch):Promise<void> {
    if (!this.activted) return
    if (this.chars!.isKeywordChar(ch)) {
      return
    }
    await this.stop()
  }

  private async gotoRange(lnum:number, range:Range):Promise<void> {
    let {nvim} = this
    await nvim.call('cursor', [lnum, range.start + 1])
  }

  private getWordAhead(content:string, col:number):string {
    let {chars} = this
    let buf = global.Buffer.from(content, 'utf8')
    let str = buf.slice(0, col).toString()
    let res = ''
    for (let i = str.length - 1; i >=0 ; i--) {
      if (chars.isKeywordChar(str[i])) {
        res = str[i] + res
      } else {
        break
      }
    }
    return res
  }
}
