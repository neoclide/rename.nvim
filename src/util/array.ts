
export function flat(arr:any[][]):any[] {
  let res:any[] = []
  for (let item of arr) {
    res.push.apply(res, item)
  }
  return res
}
