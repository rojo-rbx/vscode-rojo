import * as vscode from "vscode"
import * as Strings from "./Strings"

export enum ButtonState {
  Start,
  Running,
  Crashed,
  Downloading,
  Updating,
  Hidden
}

/**
 * A class to manage our status bar button.
 * @export
 * @class StatusButton
 */
export default class StatusButton extends vscode.Disposable {
  private button: vscode.StatusBarItem

  /**
   * Creates the status bar item and sets it to its default state.
   * @memberof StatusButton
   */
  constructor() {
    super(() => this.dispose())

    this.button = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      200
    )

    this.setState(ButtonState.Start)
  }

  /**
   * Cleans up the button.
   * @memberof StatusButton
   */
  public dispose(): void {
    this.button.dispose()
  }

  /**
   * Updates the button state to show what's going on right now.
   * @param {ButtonState} state The button state to show
   * @param {string} [version=''] The running state displays the version to the user.
   * @param {string?} projectFileName The project file used to serve Rojo.
   * @memberof StatusButton
   */
  public setState(
    state: ButtonState,
    version = "",
    projectFileName?: string
  ): void {
    this.button.show()

    switch (state) {
      case ButtonState.Start:
        this.button.text = Strings.TEXT_START
        this.button.command = "rojo.startLastUsed"
        break
      case ButtonState.Running:
        this.button.text = `${Strings.TEXT_RUNNING} ${version} ${
          projectFileName ? `[${projectFileName}]` : ""
        }`
        this.button.command = "rojo.stop"
        break
      case ButtonState.Crashed:
        this.button.text = Strings.TEXT_CRASHED
        this.button.command = "rojo.stop"
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
