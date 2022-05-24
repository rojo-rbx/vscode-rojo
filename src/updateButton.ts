import * as path from "path"
import { State } from "./extension"

export function updateButton(state: State) {
  const numRunning = Object.keys(state.running).length

  if (numRunning === 0) {
    state.resumeButton.command = "vscode-rojo.serveRecent"
    state.resumeButton.text = "$(testing-run-all-icon)"
    state.resumeButton.tooltip = "Serve most recent project file"
    return
  } else if (numRunning === 1) {
    state.resumeButton.text =
      "$(radio-tower) " +
      path.basename(Object.values(state.running)[0].projectFile.path.fsPath)
  } else {
    state.resumeButton.text = `$(radio-tower) ${numRunning} project files`
  }

  state.resumeButton.tooltip = "Stop all serving projects"
  state.resumeButton.command = "vscode-rojo.stopAll"
}
