# Rename.nvim

Rename variable made easy.

**Why?** 

It's fast and intuitive, while not listen to any of cursor events at all.

![rename](https://user-images.githubusercontent.com/251450/40627380-45a045e6-62f1-11e8-8317-06d3964f0a57.gif)

## Work flow

* Press `<C-a>` in normal mode active rename
* Optional use `n` `N` `o` `O` to navigate.
* Optional use `<C-d>` to toggle selection.
* Change the word.
* Press `<esc>` or save/leave buffer or insert none keyword to exit.

Note: navigation is possible even after word changed.

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

``` vim
:UpdateRemotePlugins
```

in neovim to make remote plugin works.

## LICENSE

MIT
