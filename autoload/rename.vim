function! rename#setup_autocmd()
  let actived = get(b:, 'rename_actived', 0)
  if actived | return | endif
  augroup rename_nvim
    autocmd!
    autocmd BufLeave,BufWritePost,BufUnload <buffer> :call RenameCancel(expand('<abuf>'))
    autocmd InsertCharPre <buffer> :call s:OnCharInsert(v:char)
  augroup end
  let b:rename_actived = 1
endfunction

function! s:OnCharInsert(char)
  if !get(g:, 'rename_activted', 0)
    return
  endif
  call RenameCharInsert(a:char)
endfunction

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

function! rename#get_execute()
  let exe = get(g:, 'rename_search_execute', '')
  if empty(exe)
    if executable('rg')
      let exe = 'rg'
    elseif executable('ag')
      let exe = 'ag'
    else
      echohl ErrorMsg | echon 'Can not find ag and rg in $PATH' | echohl None
    endif
  endif
  return exe
endfunction

function! rename#get_fullpath() abort
  let fname = bufname('%')
  if empty(fname) | return '' | endif
  return resolve(fnamemodify(fname, ':p'))
endfunction


function! rename#get_filepath()
  let lnum = line('.')
  let filepath = ''
  while lnum > 0
    let lnum = lnum - 1
    let synName = synIDattr(synID(lnum,1,1),"name")
    if synName ==# 'renameSearchFilename'
      let filepath = substitute(getline(lnum), ':$', '', '')
      break
    endif
  endw
  return filepath
endfunction
