import * as vscode from "vscode"
import * as commands from "./commands"
import { RunningProject } from "./serveProject"
import { updateButton } from "./updateButton"

export type State = {
  button: vscode.StatusBarItem
  running: { [index: string]: RunningProject }
}

let cleanup: undefined | (() => void)

export function activate(context: vscode.ExtensionContext) {
  console.log("vscode-rojo activated")

  const state: State = {
    button: vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      200
    ),
    running: {},
  }

  updateButton(state)
  state.button.command = "vscode-rojo.openMenu"
  state.button.show()

  context.subscriptions.push(
    ...Object.values(commands).map((command) => command(state))
  )

  cleanup = () => {
    for (const runningProject of Object.values(state.running)) {
      runningProject.stop()
    }
  }
}

export function deactivate() {
  if (cleanup) {
    cleanup()
    cleanup = undefined
  }
}
