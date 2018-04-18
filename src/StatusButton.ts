import * as vscode from 'vscode'
import * as Strings from './Strings'

export enum ButtonState { Start, Running, Downloading, Updating, Hidden }

/**
 * A class to manage our status bar button.
 * @export
 * @class StatusButton
 */
export default class StatusButton {
  private button: vscode.StatusBarItem

  /**
   * Creates the status bar item and sets it to its default state.
   * @memberof StatusButton
   */
  constructor () {
    this.button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200)

    this.setState(ButtonState.Start)
  }

  /**
   * Updates the button state to show what's going on right now.
   * @param {ButtonState} state The button state to show
   * @param {string} [version=''] The running state displays the version to the user.
   * @memberof StatusButton
   */
  public setState (state: ButtonState, version: string = ''): void {
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
        // Handles ButtonState.Hidden along with any other unimplemented states
        this.button.hide()
        break
    }
  }
}
