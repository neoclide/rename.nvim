import {
  Match
} from '../types'

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

export function findLiteralMathces(base:string, match:string):Match[] {
  let res:Match[] = []
  let bl = 0
  let ml = match.length
  let mbl = byteLength(match)
  for (let i = 0, l = base.length; i < l; i++) {
    let c = base[i]
    if (c == match[0] && base.slice(i, ml) == match) {
      res.push([bl, bl + byteLength(match)])
      i = i + ml - 1
      bl = bl + mbl
      continue
    }
    bl = bl + byteLength(c)
  }
  return res
}

export function findRegExMatches(base:string, regex:RegExp):Match[] {
  let res:Match[] = []
  let ms
  while (ms = regex.exec(base) !== null) { // tslint:disable-line
    let bl = byteLength(ms[0])
    let s = byteIndex(base, ms.index)
    res.push([s, s + bl])
  }
  return res
}
