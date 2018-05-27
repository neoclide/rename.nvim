import {Neovim} from 'neovim'
const logger = require('./logger')('util-index')

export function group<T>(list:T[], max:number):T[][] {
  let res = []
  let arr:T[] = []
  for (let i = 0, l = list.length; i < l; i++) {
    if (arr.length === max) {
      res.push(arr)
      arr = []
    }
    arr.push(list[i])
  }
  if (arr.length) {
    res.push(arr)
  }
  return res
}

async function echoMsg(nvim:Neovim, line: string, hl: string):Promise<void> {
  try {
    await nvim.command(`echohl ${hl} | echomsg '[rename] ${escapeSingleQuote(line)}' | echohl None"`)
  } catch (e) {
    logger.error(e.stack)
  }
  return
}

export function escapeSingleQuote(str: string):string {
  return str.replace(/'/g, "''")
}

export async function echoErr(nvim: Neovim, line: string):Promise<void> {
  return await echoMsg(nvim, line, 'Error')
}

export async function echoWarning(nvim: Neovim, line: string):Promise<void> {
  return await echoMsg(nvim, line, 'WarningMsg')
}

// nvim use utf8
export function byteLength(str:string):number {
  let buf = Buffer.from(str, 'utf8')
  return buf.length
}

export function byteIndex(content:string, index:number):number {
  let s = content.slice(0, index)
  return byteLength(s)
}

export function diffString(f:string[], t:string[]):[string, string] {
  let af = f.slice()
  let at = t.slice()
  let minLen = Math.min(af.length, at.length)
  for (let i = 0; i < minLen; i++) {
    if (af[0] == at[0]) {
      af.shift()
      at.shift()
    } else {
      break
    }
  }
  minLen = Math.min(af.length, at.length)
  for (let i = 0; i < minLen; i++) {
    if (af[af.length - 1] == at[at.length - 1]) {
      af.pop()
      at.pop()
    } else {
      break
    }
  }
  return [af.join(''), at.join('')]
}
