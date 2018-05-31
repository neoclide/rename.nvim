import {Neovim, Buffer} from 'neovim'
import {ArrayIterator} from '../util/iterator'
import {
  byteLength,
  byteIndex} from '../util/string'
import {
  Range,
  Cols
} from '../types'
const logger = require('../util/logger')('model-line')

export default class Line {
  public content:string
  public word:string
  public ranges:Range[]
  public readonly lnum:number

  constructor(word:string, content:string, lnum:number, ranges:Range[]) {
    this.word = word
    this.content = content
    this.ranges = ranges
    this.lnum = lnum
  }

  /**
   * Set a new word to current line
   *
   * @public
   * @param {string} word
   * @returns {void}
   */
  public setNewWord(word:string):void {
    let {content, ranges, lnum} = this
    ranges = ranges.filter(r => r.active)
    if (!ranges.length) return
    let origLen = ranges[0].len
    let newLine = ''
    let iterator = new ArrayIterator(ranges)
    let curr = iterator.next()
    let newLen = byteLength(word)
    let idx = 0
    for (let i = 0, l = content.length; i < l; i++) {
      let b = byteIndex(content, i)
      if (curr && b === curr.start) {
        curr.start = b + (newLen - origLen)*idx
        curr.len = newLen
        newLine = newLine + word
        curr = iterator.next()
        i = i + origLen - 1
        idx = idx + 1
      } else {
        newLine = newLine + content[i]
      }
    }
    // end of line
    if (curr && curr.start == byteLength(content)) {
      curr.start = byteLength(newLine)
      curr.len = newLen
      newLine = newLine + word
    }
    this.word = word
    this.content = newLine
  }

  public getRange(col:number):Range|null {
    let idx = col - 1
    for (let r of this.ranges) {
      if (idx >= r.start && idx < r.start + r.len) {
        return r
      }
    }
    return null
  }

  public resetRanges():void {
    this.ranges = this.ranges.filter(r => {
      return r.active
    })
  }

  public getNextRange(col:number):Range|null {
    let {ranges} = this
    let idx = col - 1
    for (let i = 0; i < ranges.length; i++) {
      let r = ranges[i]
      if (idx >= r.start && idx <r.start + r.len) {
        return ranges[i + 1]
      }
    }
    return null
  }

  public getPrevRange(col:number):Range|null {
    let {ranges} = this
    let idx = col - 1
    for (let i = 0; i < ranges.length; i++) {
      let r = ranges[i]
      if (idx >= r.start && idx <r.start + r.len) {
        return ranges[i - 1]
      }
    }
    return null
  }

  public get firstRange():Range {
    return this.ranges[0]
  }

  public get lastRange():Range {
    let {ranges} = this
    return ranges[ranges.length - 1]
  }

  public get firstActive():Range|null {
    return this.ranges.find(o => o.active)
  }

  public get lastActive():Range|null {
    let list = this.ranges.filter(r => r.active)
    return list[list.length - 1]
  }

  public get activeRanges():Range[] {
    return this.ranges.filter(r => r.active)
  }
}
