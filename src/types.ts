export type State = 'navigate' | 'edit'

export const enum LineType {
  Path,
  Content,
  Seperator,
  Empty,
  Unknown,
}

export interface LineInfo {
  content:string
  lineType:LineType
}

export interface MatchInfo {
  lnum:number
  start:number
  end:number
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

export const enum ChangeType {
  Delete,
  Update,
}

export interface LineChange {
  changeType:ChangeType
  content:string|null
  lnum:number
}

export type Line = [number, string]

// column position of match, 0 based
export type Match = [number, number]

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
