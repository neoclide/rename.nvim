import {MatchItem} from '../types'

const foregroundColors = { 30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'white',
  90: 'grey'
}

const backgroundColors = {
  40: 'black',
  41: 'red',
  42: 'green',
  43: 'yellow',
  44: 'blue',
  45: 'magenta',
  46: 'cyan',
  47: 'white'
}

const styles = {
  1: 'bold',
  3: 'italic',
  4: 'underline'
}

function ansiparse(str:string):MatchItem[] {
  //
  // I'm terrible at writing parsers.
  //
  let matchingControl = null
  let matchingData = null
  let matchingText = ''
  let ansiState = []
  let result = []
  let state:Partial<MatchItem> = {}
  let eraseChar

  //
  // General workflow for this thing is:
  // \033\[33mText
  // |     |  |
  // |     |  matchingText
  // |     matchingData
  // matchingControl
  //
  // \033\[K
  //
  // In further steps we hope it's all going to be fine. It usually is.
  //

  //
  // Erases a char from the output
  //
  eraseChar = () => {
    let index
    let text
    if (matchingText.length) {
      matchingText = matchingText.substr(0, matchingText.length - 1)
    }
    else if (result.length) {
      index = result.length - 1
      text = result[index].text
      if (text.length === 1) {
        //
        // A result bit was fully deleted, pop it out to simplify the final output
        //
        result.pop()
      }
      else {
        result[index].text = text.substr(0, text.length - 1)
      }
    }
  }

  for (let i = 0; i < str.length; i++) { // tslint:disable-line
    if (matchingControl != null) {
      if (matchingControl == '\x1b' && str[i] == '\[') {
        //
        // We've matched full control code. Lets start matching formating data.
        //

        //
        // "emit" matched text with correct state
        //
        if (matchingText) {
          state.text = matchingText
          result.push(state)
          state = {}
          matchingText = ''
        }

        matchingControl = null
        matchingData = ''
      } else {
        //
        // We failed to match anything - most likely a bad control code. We
        // go back to matching regular strings.
        //
        matchingText += matchingControl + str[i]
        matchingControl = null
      }
      continue
    } else if (matchingData != null) {
      if (str[i] == ';') {
        //
        // `;` separates many formatting codes, for example: `\033[33;43m`
        // means that both `33` and `43` should be applied.
        //
        // TODO: this can be simplified by modifying state here.
        //
        ansiState.push(matchingData)
        matchingData = ''
      } else if (str[i] == 'm' || str[i] == 'K') {
        //
        // `m` finished whole formatting code. We can proceed to matching
        // formatted text.
        //
        ansiState.push(matchingData)
        matchingData = null
        matchingText = ''

        //
        // Convert matched formatting data into user-friendly state object.
        //
        // TODO: DRY.
        //
        ansiState.forEach(ansiCode => {
          if (foregroundColors[ansiCode]) {
            state.foreground = foregroundColors[ansiCode]
          } else if (backgroundColors[ansiCode]) {
            state.background = backgroundColors[ansiCode]
          } else if (ansiCode == 39) {
            delete state.foreground
          } else if (ansiCode == 49) {
            delete state.background
          } else if (styles[ansiCode]) {
            state[styles[ansiCode]] = true
          } else if (ansiCode == 22) {
            state.bold = false
          } else if (ansiCode == 23) {
            state.italic = false
          } else if (ansiCode == 24) {
            state.underline = false
          }
        })
        ansiState = []
      }
      else {
        matchingData += str[i]
      }
      continue
    }

    if (str[i] == '\x1b') {
      matchingControl = str[i]
    } else if (str[i] == '\u0008') {
      eraseChar()
    } else {
      matchingText += str[i]
    }
  }

  if (matchingText) {
    state.text = matchingText + (matchingControl ? matchingControl : '')
    result.push(state)
  }
  return result
}

export default ansiparse
