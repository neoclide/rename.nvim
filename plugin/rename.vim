if exists('did_rename_nvim_loaded') || v:version < 700
  finish
endif
let did_rename_nvim_loaded = 1
let g:rename_activted = 0
let g:rename_search_vcs_root = get(g:, 'rename_search_vcs_root', 1)
let g:rename_search_execute = get(g:, 'rename_search_execute', '')
let g:rename_search_winpos = get(g:, 'rename_search_winpos', 'left')
let g:rename_spinner_type = get(g:, 'rename_spinner_type', 'bouncingBar')
let g:rename_search_extra_args = get(g:, 'rename_search_extra_args', ['-C', 3])

function! s:SetSearchBuffer()
  setl bufhidden=hide
  setl buftype=nofile
  setl nobuflisted
  setl nolist
  setl nospell
  setl noswapfile
  setl scrolloff=0
  setl textwidth=0
  setl winfixheight
  setl winfixwidth
  syntax clear
  syntax case match
  syntax match renameSearchFilename    /^.*\ze:$/
  syntax match renameSearchLnumMatch   /^\d\+:/
  syntax match renameSearchLnumUnmatch /^\d\+-/
  syntax match renameSearchCuttingLine /^\.\+$/
  syntax match renameSearchError /^Error:/
  syntax match renameSearchFirstLine   /\%1l.*/
  syntax match renameSearchLabel /\w\+:/ contained containedin=renameSearchFirstLine
  syntax match renameSearchNumber /\d\+/ contained containedin=renameSearchFirstLine

  " highlightment group can be shared between different syntaxes
  hi def link renameSearchFilename     Title
  hi def link renameSearchLnumMatch    MoreMsg
  hi def link renameSearchLnumUnmatch  LineNr
  hi def link renameSearchSelectedLine Visual
  hi def link renameSearchMatch        Special
  hi def link renameSearchError        Error
  hi def link renameSearchLabel        Label
  hi def link renameSearchNumber       Number

  nnoremap <silent> <buffer> <C-c> :<C-u>RenameSearchStop<CR>
  nnoremap <buffer> q     :bd!<CR>
  nnoremap <buffer> <CR>  :call RenameSearchAction('open', 0)<CR>
  nnoremap <buffer> s     :call RenameSearchAction('open', 1)<CR>
  nnoremap <buffer> t     :call RenameSearchAction('open', 2)<CR>
  nnoremap <buffer> p     :call RenameSearchAction('open', 3)<CR>
  nnoremap <buffer> <C-n> :call RenameSearchAction('move', 'next')<CR>
  nnoremap <buffer> <C-p> :call RenameSearchAction('move', 'prev')<CR>

  command! -nargs=0 -buffer -bang RenameSearchStop :call RenameSearchAction('stop','<bang>')
  doautocmd User RenameSearchStart
  let b:search_cwd = getcwd()
endfunction

function! s:Start(currentOnly)
  if get(g:, 'rename_activted', 0)
    return
  endif
  let cword = expand('<cword>')
  if empty(cword) | return | endif
  call RenameStart({
        \ 'cword': cword,
        \ 'iskeyword': &iskeyword,
        \ 'currentOnly': a:currentOnly,
        \})
  return
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

  execute 'nnoremap <silent> '.start_key.' :call <SID>Start(0)<CR>'
  execute 'nnoremap <silent><expr> '.toggle_key.' g:rename_activted ?'
        \.' ":call RenameToggle()<CR>" : ":call <SID>Start(1)<CR>"'

  call s:CreateKeyMap(next_key, 'RenameNext')
  call s:CreateKeyMap(prev_key, 'RenamePrev')
  call s:CreateKeyMap(begin_key, 'RenameBegin')
  call s:CreateKeyMap(end_key, 'RenameEnd')
  call s:CreateKeyMap('<esc>', 'RenameCancel')

  augroup rename_search
    autocmd!
    autocmd BufNewFile __rename_search__  :call s:SetSearchBuffer()
    autocmd BufUnload __rename_search__ call RenameBufferUnload(+expand('<abuf>'))
  augroup end
endfunction

call s:Init()
