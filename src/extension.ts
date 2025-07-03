import * as vscode from "vscode"
import * as commands from "./commands"
import { RunningProject } from "./serveProject"
import { updateButton } from "./updateButton"

export type State = {
  resumeButton: vscode.StatusBarItem
  running: { [index: string]: RunningProject }
  context: vscode.ExtensionContext
}

let cleanup: undefined | (() => void)
let configurationDisposable: vscode.Disposable | undefined

export function activate(context: vscode.ExtensionContext) {
  console.log("vscode-rojo activated")

  const state: State = {
    resumeButton: vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      199
    ),
    running: {},
    context,
  }

  const button = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    200
  )
  button.command = "vscode-rojo.openMenu"
  button.text = "$(rocket) Rojo"
  button.show()

  updateButton(state)
  state.resumeButton.show()

  context.subscriptions.push(
    ...Object.values(commands).map((command) => command(state))
  )

  configurationDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("rojo.additionalProjectPaths")) {
      console.log("rojo.additionalProjectPaths configuration changed")
      
      vscode.window.showInformationMessage(
        "Rojo: Additional project paths updated. New paths will be searched when opening the project menu.",
        { modal: false }
      )
    }
  })

  context.subscriptions.push(configurationDisposable)

  cleanup = () => {
    for (const runningProject of Object.values(state.running)) {
      runningProject.stop()
    }
  }

  if (
    context.globalState.get("news::rojo7") ||
    context.globalState.get("news::multipleProjectFiles")
  ) {
    vscode.window
      .showInformationMessage(
        "The Rojo extension has received a major upgrade. We recommend reading the extension description page.",
        "Open extension page",
        "Don't show this again"
      )
      .then((option) => {
        if (!option) {
          return
        }

        if (option?.includes("Open")) {
          vscode.env.openExternal(
            vscode.Uri.from({
              scheme: vscode.env.uriScheme,
              path: "extension/evaera.vscode-rojo",
            })
          )
        }

        context.globalState.update("news::rojo7", undefined)
        context.globalState.update("news::multipleProjectFiles", undefined)
      })
  }
}

export function deactivate() {
  if (cleanup) {
    cleanup()
    cleanup = undefined
  }

  if (configurationDisposable) {
    configurationDisposable.dispose()
    configurationDisposable = undefined
  }
}
