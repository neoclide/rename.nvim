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
  diffString,
  echoMessage
} from './util/index'
import debounce = require('debounce')

const logger = require('./util/logger')('manager')

function getChangeId(lines:string[], start:number, end:number):string|null {
  if (lines.length != end - start) return null
  if (lines.length == 0) return null
  if (lines.length == 1) return lines[0]
  return `${start}-${end}`
}

export default class Manager {
  public activted:boolean
  public bufnr:number
  private changeId:string
  private changing:boolean
  private chars:Chars
  private lines:Line[]
  private buffer:Buffer|null
  private readonly nvim:Neovim
  private srcId: number
  private maxLnum:number
  private minLnum:number

  constructor(nvim:Neovim) {
    this.activted = false
    this.nvim = nvim
    this.srcId = 9527
    this.changing = false

    const delay = 100
    let callback = debounce((line, content) => {
      this.onLineChange(line, content).catch(e => {
        logger.error(e.stack)
      })
    }, delay, false)

    nvim.on('notification', (name, args) => {
      if (!this.activted) return
      if (name === 'nvim_buf_lines_event') {
        let [buf, tick, firstline, lastline, linedata, more] = args
        if (!this.buffer.equals(buf)) return
        // change from set lines or undo/redo
        let {changeId} = this
        if (changeId && changeId == getChangeId(linedata, firstline, lastline)) {
          // this.changeId = null
          return
        }
        let line = this.lines.find(o => o.lnum == firstline + 1)
        if (!line
          || lastline - firstline != 1
          || linedata.length != 1) {
          callback.clear()
          echoWarning(nvim, 'Unexpected line change detected').catch(() => {}) // tslint:disable-line
          this.stop().catch(err => {
            logger.error(err.stack)
          })
          return
        }
        callback(line, linedata[0])
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
    let newLines = await buffer.getLines({
      start: minLnum - 1,
      end: maxLnum,
      strictIndexing: true })
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

    this.changing = true
    this.changeId = getChangeId(newLines, minLnum - 1, maxLnum)
    try {
      await buffer.setLines(newLines, {
        start: minLnum - 1,
        end: maxLnum,
        strictIndexing: true
      })
    } catch (e) {
      this.changing = false
      // user typing
      if (/Vim:E523/.test(e.message)) {
        return
      }
    }
    // fix cursor position
    if (pl) {
      col = col + pl * dc
      await nvim.call('cursor', [lnum, col])
    }
    await buffer.clearHighlight({srcId})
    await Promise.all(hls.map(o => {
      return this.addHighlight(o.lnum, o.start, o.end)
    }))
    this.changing = false
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
    let range = null
    for (let i = 0, l = contents.length; i < l; i++) {
      let text = contents[i]
      if (ignoreRegex && ignoreRegex.test(text)) continue
      let ranges = chars.getRanges(text, cword)
      if (ranges.length == 0) continue
      let obj = new Line(cword, text, i + 1, ranges)
      if (i + 1 == lnum) {
        range = obj.getRange(col)
      }
      this.lines.push(obj)
    }
    this.minLnum = lines.length ? lines[0].lnum : 0
    this.maxLnum = lines.length ? lines[lines.length - 1].lnum : 0
    this.bufnr = bufnr
    this.activted = true
    await this.nvim.command('let g:rename_activted = 1')
    // TODO may need change params
    await buffer.request('nvim_buf_attach', [buffer, false, {}])
    await this.nvim.call('clearmatches', [])
    await this.highlightAll()
    if (range) {
      await this.echoMessage(range)
    }
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

  public async highlightAll():Promise<void> {
    let {srcId, buffer} = this
    for (let line of this.lines) {
      let {ranges, lnum} = line
      for (let r of ranges) {
        await this.addHighlight(lnum, r.start, r.start + r.len)
      }
    }
  }

  // goto next
  public async nextItem():Promise<void> {
    let {maxLnum, lines, nvim} = this
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
    let {nvim, lines} = this
    let pos = await this.nvim.call('getcurpos')
    for (let line of lines) {
      let r = line.firstActive
      if (r) {
        if (!isRedirect && line.lnum === pos[1] && r.start + 1 === pos[2]) {
          await this.navigateLast(true)
          break
        } else {
          await this.gotoRange(line.lnum, r)
        }
        return
      }
    }
  }

  // goto last active item
  public async navigateLast(isRedirect?:boolean):Promise<void> {
    let {nvim, lines} = this
    let pos = await this.nvim.call('getcurpos')
    for (let i = lines.length - 1; i >= 0; i--) {
      let line = lines[i]
      let r = line.lastActive
      if (r) {
        if (!isRedirect && line.lnum === pos[1] && r.start + 1 === pos[2]) {
          await this.navigateFirst(true)
        } else {
          await this.gotoRange(line.lnum, r)
        }
        return
      }
    }
  }

  public async toggleActive(lnum:number, col:number):Promise<void> {
    let {lines, srcId, buffer} = this
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
    await this.echoMessage(range)
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

  private async echoMessage(r:Range):Promise<void> {
    let {nvim} = this
    let [i, total] = this.getCountInfo(r)
    let {word} = this.lines[0]
    await echoMessage(nvim, `/\\<${word}\\> match ${i} of ${total}`)
  }

  private getCountInfo(r:Range):[number, number] {
    let i = 0
    let total = 0
    let found = false
    for (let line of this.lines) {
      let {activeRanges} = line
      total += activeRanges.length
      if (!found) {
        for (let item of activeRanges) {
          i = i + 1
          if (item === r) {
            found = true
            break
          }
        }
      }
    }
    if (!found) {
      i = 0
    }
    return [i, total]
  }
}
