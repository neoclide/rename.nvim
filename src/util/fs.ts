import {
  LineChange,
  ChangeType,
} from '../types'
import pify = require('pify')
import fs = require('fs')
import detectNewline = require('detect-newline')

export async function applyChanges(fullpath:string, changes:LineChange[]):Promise<boolean> {
  let content = await pify(fs.readFile)(fullpath, 'utf8')
  let sep = detectNewline(content)
  let lines = content.split(sep)
  for (let c of changes) {
    let {changeType, content, lnum} = c
    if (changeType == ChangeType.Update) {
      lines[lnum - 1] = content
    }
  }
  lines = lines.filter(l => l != null)
  await pify(fs.writeFile)(fullpath, lines.join(sep), 'utf8')
  return true
}
