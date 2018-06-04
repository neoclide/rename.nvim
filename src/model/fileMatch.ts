import {Buffer} from 'neovim'
import {
  Match,
  MatchInfo,
  Line,
  LineChange,
  ChangeType,
} from '../types'
const logger = require('../util/logger')('model-filematch')

export default class FileMatch {
  // filepath relative to original vim cwd
  public readonly startLnum:number
  public titleLine?:string
  public filePath:string
  public lines:string[]
  public matches:MatchInfo[]
  public inserted = false

  /**
   * constructor
   *
   * @public
   * @param {string} file - relative file path
   * @param {number} lnum - line number for file title
   * @returns {undefined}
   */
  constructor(file:string, lnum:number) {
    this.startLnum = lnum
    this.filePath = file
    this.lines = []
    this.matches = []
  }

  public addLine(content:string, matches?:Match[]):void {
    let {startLnum} = this
    this.lines.push(content)
    let lnum = startLnum + this.lines.length
    if (!matches) return
    for (let m of matches) {
      this.matches.push({
        lnum,
        start: m[0],
        end: m[1]
      })
    }
  }

  public async appendTo(buffer:Buffer):Promise<void> {
    let insert = []
    let {filePath, lines, matches, inserted} = this
    if (inserted) return
    this.inserted = true
    let titleLine = this.titleLine = `$${filePath}: (${matches.length} matches)`
    insert.push(titleLine)
    insert = insert.concat(lines)
    await buffer.append(insert)
    await Promise.all(matches.map(m => {
      return buffer.addHighlight({
        srcId: 0,
        hlGroup: 'renameSearchMatch',
        line: m.lnum - 1,
        colStart: m.start,
        colEnd: m.end,
        async: true
      })
    }))
  }

  public applyChanges(changes:LineChange[]):void {
    let {lines, filePath} = this
    for (let c of changes) {
      let {lnum, changeType, content} = c
      let s = `${lnum}:`
      let idx = lines.findIndex(c => c.startsWith(s))
      if (idx !== -1) {
        lines[idx] = `${lnum}:${content}`
      } else {
        logger.error(`${lnum} of ${filePath} not found`)
      }
    }
  }

  public get matchedLines():Line[] {
    let lines:Line[] = []
    for (let str of this.lines) {
      if (/^\d+:/.test(str)) {
        let ms = str.match(/^(\d+):(.*)$/)
        lines.push([Number(ms[1]), ms[2]])
      }
    }
    return lines
  }

  public get lineCount():number {
    return this.lines.length + 1
  }

  public get matchCount():number {
    return this.matches.length
  }
}
