export interface INextIterator<T> {
    next(): T;
    previous(): T;
}
export declare class ArrayIterator<T> implements INextIterator<T> {
    private items;
    protected start: number;
    protected end: number;
    protected index: number;
    constructor(items: T[], start?: number, end?: number);
    first(): T;
    previous(): T;
    last(): T;
    next(): T;
    protected current(): T;
}
