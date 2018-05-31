export type State = 'navigate' | 'edit'

export const enum OpenType {
  Edit,
  Split,
  Tab,
  Preview,
}

export interface Position{
  lnum:number
  startCol:number
  endCol:number
}

export interface PositionItem {
  lnum:number
  rangeIdx:number
}

export interface StartOption {
  cword:string
  iskeyword:string
  currentOnly?:boolean
  includePattern?:string
}

export interface DiffItem {
  0:number
  1:string
}

// column position of match, 0 based
export interface Match {
  0:number
  1:number
}

export interface Range {
  start:number
  len:number
  active:boolean
}

export interface Cols {
  start:number
  end:number
}

export interface SpinConfig {
  interval:number
  frames:string[]
}

export interface SearchInfo {
  searchType: 'literal' | 'word' | 'regex'
  word?:string
  regexList?:string[]
  literal?:string
}

export interface MatchItem {
  foreground?:string
  background?:string
  bold?:boolean
  italic?:boolean
  underline?:boolean
  text:string
}
