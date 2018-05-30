
" Get start/end line and the lines between
function! rename#get_content(word)
  let lines = getline(1, '$')
  let lnum = 1
  let start = 0
  let end = len(lines)
  let r = range(start + 1, end)
  for idx in r
    if match(lines[idx - 1], a:word) != -1
      let start = idx
      break
    endif
  endfor
  if start == 0 | return v:null | endif
  for idx in r
    if match(lines[end - 1], a:word) != -1
      break
    else
      let end = end - 1
    endif
  endfor
  return [start, end, join(lines[start - 1 : end - 1], "\n")]
endfunction
