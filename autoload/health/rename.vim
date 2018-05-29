function! s:checkEnvironment() abort
  let valid = 1
  if !has('nvim') || !has('nvim-0.3.0')
    let valid = 0
    call health#report_error('Neovim version not satisfied, 0.3.0 and above required')
  endif
  if !executable('node') || !executable('npm')
    let valid = 0
    call health#report_error(
      \ '`node` and `npm` must be in $PATH.',
      \ ['Install Node.js and verify that `node` and `npm` commands work.'])
  endif
  let output = system('node -v')
  if v:shell_error && output !=# ""
    echohl Error | echon output | echohl None
    return
  endif
  let ms = matchlist(output, '^v\(\d\+\)')
  if empty(ms) || str2nr(ms[1]) < 8
    let valid = 0
    call health#report_error('Node.js version '.output.' too low, consider upgrade to node.js 8.0')
  endif
  let host = provider#node#Detect()
  if empty(host)
    let valid = 0
    call health#report_warn('Missing "neovim" npm package.',
          \ ['Run in shell: npm install -g neovim'])
    return
  endif
  if valid
    call health#report_ok('Environment check passed')
  endif
  return valid
endfunction

function! s:checkFunction() abort
  try
    call RenameCancel()
    call health#report_ok('Function check passed')
  catch /^Vim\%((\a\+)\)\=:E117/
    call health#report_error('Rename function not found!', [
          \ "Try command ':UpdateRemotePlugins' and restart your vim"
          \])
    return 0
  endtry
endfunction

function! health#rename#check() abort
    call s:checkEnvironment()
    call s:checkFunction()
endfunction
