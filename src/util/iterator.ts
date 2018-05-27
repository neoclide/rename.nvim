export interface INextIterator<T> {
  next(): T
  previous(): T
}

export class ArrayIterator<T> implements INextIterator<T> {

  private items: T[]
  protected start: number
  protected end: number
  protected index: number

  constructor(items: T[], start = 0, end: number = items.length) {
    this.items = items
    this.start = start
    this.end = end
    this.index = start - 1
  }

  public first(): T {
    this.index = this.start
    return this.current()
  }

  public previous(): T {
    this.index = this.index - 1
    return this.current()
  }

  public last(): T {
    this.index = this.end - 1
    return this.current()
  }

  public next(): T {
    this.index = Math.min(this.index + 1, this.end)
    return this.current()
  }

  protected current(): T {
    if (this.index === this.start - 1 || this.index === this.end) {
      return null
    }

    return this.items[this.index]
  }
}
