# Rename.nvim

[![](http://img.shields.io/github/issues/neoclide/rename.nvim.svg)](https://github.com/neoclide/rename.nvim/issues)
[![](http://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![](https://img.shields.io/badge/doc-%3Ah%20rename.txt-red.svg)](doc/rename.txt)

Rename variable made easy.

**Why?** 

It's fast and intuitive, while not listen to any of `Cursor` & `TextChange` events at all.

![partial](https://user-images.githubusercontent.com/251450/40894260-fce77880-67da-11e8-8ee8-6b632edf99c7.gif)

Start partial replace by `<C-d>`.

![buffer](https://user-images.githubusercontent.com/251450/40894254-f56d2352-67da-11e8-86d5-c9292205b097.gif)

Start replace in current buffer by `<C-a>`.

![project](https://user-images.githubusercontent.com/251450/40894264-ff94b782-67da-11e8-91e7-c8f07a17c7e0.gif)

Start project wide replace by mapping to `<Plug>(rename-search-replace)`

Be sure to check out `:h rename-nvim` for full features.

## Work flow

* Press `<C-a>` or `<C-d>` in normal mode to active.
* Optional use `n` `N` `o` `O` to navigate.
* Optional use `<C-d>` to toggle selection.
* Change the word.
* Press `<esc>` or save/leave buffer or insert none keyword to exit.

**Note:** You're free to move your cursor after active rename and text change.

## Install

This plugin make use of buffer notification feature, you'll have to build your
neovim with PR: [neovim/pull/7917](https://github.com/neovim/neovim/pull/7917)

Install [nodejs](http://nodejs.org/) version > 8.0, and run command:

    npm install -g neovim

to install neovim node client globally.

Install plugin by plugin manager, like [dein.vim](https://github.com/Shougo/dein.vim) by add:

``` vim
 call dein#add('neoclide/rename.nvim', {
    \ 'build': 'npm install --only=production'
    \})
```

to your `init.vim` and run:

``` vim
:call dein#install()
```

in neovim.

When using other plugin manager, you may need to run:

```
npm install --only=production
```

in the directory of this plugin and run

``` vim
:UpdateRemotePlugins
```

in neovim to make remote plugin works.

## Trouble shooting

When you find the plugin is not working as expected, run command
`:checkhealth` and make use that output from `rename.nvim` are **OK**.

To get the log file, run shell command:

    node -e 'console.log(path.join(os.tmpdir(), "rename-nvim.log"))'

## LICENSE

MIT
