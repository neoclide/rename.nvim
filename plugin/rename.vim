if exists('did_rename_loaded') || v:version < 700
  finish
endif
let did_rename_loaded = 1
let g:rename_activted = 0

function! s:Start()
  if get(g:, 'rename_activted', 0)
    return
  endif
  let pos = getcurpos()
  let cword = expand('<cword>')
  if empty(cword) | return '' | endif
  call RenameStart({
        \ 'content': join(getline(1, '$'), "\n"),
        \ 'cword': cword,
        \ 'lnum': pos[1],
        \ 'col': pos[2],
        \ 'bufnr': bufnr('%'),
        \ 'iskeyword': &iskeyword,
        \})
  return
endfunction

function! s:OnCharInsert(char)
  if !get(g:, 'rename_activted', 0)
    return
  endif
  call RenameCharInsert(a:char)
endfunction

function! s:CreateKeyMap(key, func)
  execute 'nnoremap <silent><expr> '.a:key.' g:rename_activted ? ":call '.a:func.'()<CR>" : "'.a:key.'"'
endfunction

function! s:Init()
  let guifg = get(g:, 'rename_hl_guifg', 'white')
  let guibg = get(g:, 'rename_hl_guibg', 'magenta')
  exec "highlight default NvimRename guifg=".guifg." guibg=".guibg." ctermfg=white ctermbg=".(&t_Co < 256 ? "magenta" : "201")

  let start_key = get(g:, 'rename_start_key', '<C-a>')
  let toggle_key = get(g:, 'rename_toggle_key', '<C-d>')
  let next_key = get(g:, 'rename_next_key', 'n')
  let prev_key = get(g:, 'rename_prev_key', 'N')
  let begin_key = get(g:, 'rename_begin_key', 'o')
  let end_key = get(g:, 'rename_end_key', 'O')

  execute 'nnoremap <silent>'start_key.' :call <SID>Start()<CR>'
  call s:CreateKeyMap(toggle_key, 'RenameToggle')
  call s:CreateKeyMap(next_key, 'RenameNext')
  call s:CreateKeyMap(prev_key, 'RenamePrev')
  call s:CreateKeyMap(begin_key, 'RenameBegin')
  call s:CreateKeyMap(end_key, 'RenameEnd')
  call s:CreateKeyMap('<esc>', 'RenameCancel')

  augroup rename_nvim
    autocmd!
    autocmd BufLeave,BufWritePost,BufUnload * :call RenameCancel(expand('<abuf>'))
    autocmd InsertCharPre * :call s:OnCharInsert(v:char)
  augroup end
endfunction

call s:Init()