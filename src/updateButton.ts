import { State } from "./extension"
import { formatProjectDisplayName } from "./projectDisplay"

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
      formatProjectDisplayName(Object.values(state.running)[0].projectFile)
  } else {
    state.resumeButton.text = `$(radio-tower) ${numRunning} project files`
  }

  state.resumeButton.tooltip = "Stop all serving projects"
  state.resumeButton.command = "vscode-rojo.stopAll"
}
