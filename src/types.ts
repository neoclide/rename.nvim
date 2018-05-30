
export type State = 'navigate' | 'edit'

export interface PositionItem {
  lnum: number
  rangeIdx: number
}

export interface StartOption {
  cword: string
  iskeyword: string
  currentOnly?:boolean
  includePattern?: string
}

export interface DiffItem {
  0: number
  1: string
}

export interface Range {
  start: number
  len: number
  active: boolean
}

export interface Cols {
  start: number
  end: number
}
