import vscode from "vscode"
import { statusButton } from "../extension"
import { Rojo } from "../Rojo"
import { ButtonState } from "../StatusButton"

/**
 * Rojo: Stop server command. Kills the previously-running rojo.exe and closes the file watcher.
 */
export const stopCommand = vscode.commands.registerCommand("rojo.stop", () => {
  // If there's at least one Rojo instance running...
  Rojo.stopLast()

  // If there are no more Rojo instances running, reset the button back to the "Start" state.
  if (!Rojo.isAnyRunning()) {
    statusButton.setState(ButtonState.Start)
  }
})
