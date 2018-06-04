const options = []

function defineOptions(s:string, l:string, ag:string, rg:string):void {
  options.push([s, l, ag, rg])
}

defineOptions('-A', '-after', '--after', '--after-context')
defineOptions('-B', '-before', '--before', '--before-context')
// ag has bug with --context
defineOptions('-C', '-context', '-C', '--context')
defineOptions('-S', '-smartcase', '--smart-case', '--smart-case')
defineOptions('-i', '-ignorecase', '--ignore-case', '--ignore-case')
defineOptions('-l', '-literal', '--fixed-strings', '--fixed-strings')
defineOptions('-w', '-word', '--word-regexp', '--word-regexp')
defineOptions('-e', '-regex', '', '--regexp')
defineOptions('-u', '-skip-vcs-ignores', '--skip-vcs-ignores', '--no-ignore-vcs')
defineOptions('-t', '-extension', null, null)

const singleOptions = ['--smart-case', '--ignore-case', '--skip-vcs-ignores', '--no-ignore-vcs']

function getOption(opt:string, command:string):string {
  let idx = opt.length == 2 ? 0 : 1
  let o = options.find(o => o[idx] == opt)
  if (!o) return ''
  return command === 'ag' ? o[2] : o[3]
}

export const optionList = options.map(o => o[1])

export function convertOptions(list:string[], command:string):string[][] {
  let useLiteral = list.find(o => {
    return ['-e', '-regex', '-w', '-word', '-l', '-literal'].indexOf(o) != -1
  }) == null
  let res:string[][] = []
  if (useLiteral) list.unshift('-l')
  let singles = []
  for (let idx = 0; idx < list.length; idx++) {
    let s = list[idx]
    if (/^-/.test(s)) {
      if (s === '-t' || s === '-extension') {
        let f = list[idx + 1]
        if (!f || /^-/.test(f)) continue
        if (command == 'rg') {
          res.push(['--glob', `*.${f}`])
        } else {
          res.push(['-G', `*.${f}`])
        }
        idx++
      } else {
        let opt = getOption(s, command)
        if (singleOptions.indexOf(opt) !== -1) {
          res.push([opt])
        } else {
          let f = list[idx + 1]
          if (!f || /^-/.test(f)) {
            singles.push(opt)
          } else {
            res.push([opt, f])
            idx++
          }
        }
      }
    } else {
      singles.push(s)
    }
  }
  // ag use smartcase by default, we don't like that
  if (command === 'ag'
    && list.indexOf('-S') === -1
    && list.indexOf('-smartcase') === -1) {
    res.unshift(['-s'])
  }
  res.push(singles)
  return res
}
