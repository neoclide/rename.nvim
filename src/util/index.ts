import {Neovim} from 'neovim'
import fs = require('fs')
import path = require('path')
const logger = require('./logger')('util-index')
const vsc_folderss = ['.git', '.hg', '.svn', '.bzr', '_darcs']

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

export async function echoMessage(nvim: Neovim, line: string):Promise<void> {
  return await echoMsg(nvim, line, 'MoreMsg')
}

export function debounce(fn:Function, t:number):Function {
  let last = null
  let timeout = null
  let cb = (...args) => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    let ts = Date.now()
    if (!last || ts - last > t) {
      last = ts
      fn.apply(null, args)
    } else {
      timeout = setTimeout(cb.apply(null, args), t + 10)
    }
  }
  return cb
}

export function findVcsRoot(dir:string):string|null {
  let {root} = path.parse(dir)
  let p = null
  while (dir != root) {
    for (let n of vsc_folderss) {
      if (fs.existsSync(path.join(dir, n))) {
        p = dir
        break
      }
    }
    dir = path.dirname(dir)
  }
  return p
}
