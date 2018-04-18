import * as vscode from 'vscode'
import * as Strings from './Strings'

export enum ButtonState { Start, Running, Downloading, Updating, Hidden }

export default class StatusButton {
  private button: vscode.StatusBarItem

  constructor () {
    this.button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200)

    this.setState(ButtonState.Start)
  }

  setState (state: ButtonState, version: string = ''): void {
    this.button.show()

    switch (state) {
      case ButtonState.Start:
        this.button.text = Strings.TEXT_START
        this.button.command = 'rojo.start'
        break
      case ButtonState.Running:
        this.button.text = `${Strings.TEXT_RUNNING} ${version}`
        this.button.command = 'rojo.stop'
        break
      case ButtonState.Updating:
        this.button.text = Strings.TEXT_UPDATING
        this.button.command = undefined
        break
      case ButtonState.Downloading:
        this.button.text = Strings.TEXT_DOWNLOADING
        this.button.command = undefined
        break
      default:
        this.button.hide()
        break
    }
  }
}
