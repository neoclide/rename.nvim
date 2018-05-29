# Rename.nvim

Rename variable made easy.

**Why?** 

It's fast and intuitive, while not listen to any of `Cursor` & `TextChange` events at all.

![rename gif](https://user-images.githubusercontent.com/251450/40681334-6e9bd83c-63bb-11e8-91db-ef80a30e66e7.gif)

## Work flow

* Press `<C-a>` in normal mode active rename
* Optional use `n` `N` `o` `O` to navigate.
* Optional use `<C-d>` to toggle selection.
* Change the word.
* Press `<esc>` or save/leave buffer or insert none keyword to exit.

**Note:** You're free to move your cursor after active rename.

**Note:** Navigation is possible even after word changed.

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
