import * as vscode from "vscode"
import * as commands from "./commands"
import { Rojo } from "./Rojo"
import StatusButton from "./StatusButton"
import Telemetry from "./Telemetry"
import {
  createOrShowInterface,
  getPluginIsManaged,
  shouldShowNews
} from "./Util"
import { getBridge, resetBridge } from "./util/getBridge"

export let extensionContext: vscode.ExtensionContext
export let statusButton: StatusButton

export function reset() {
  Rojo.stopAll()
  resetBridge()
}

/**
 * The main extension activation function that is called by VS Code when the extension starts.
 * @export
 * @param {vscode.ExtensionContext} context The ExtensionContext provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('"vscode-rojo" is now active!')

  extensionContext = context
  statusButton = new StatusButton()

  Telemetry.initialize(context)

  // Listen to configuration changes
  const configurationChangeSignal = vscode.workspace.onDidChangeConfiguration(
    e => {
      if (
        e.affectsConfiguration("rojo.releaseBranch") ||
        e.affectsConfiguration("rojo.targetVersion")
      ) {
        reset()
      }
    }
  )

  // Tell VS Code about our disposable commands so they get cleaned up when VS Code reloads.
  context.subscriptions.push(
    ...Object.values(commands),
    configurationChangeSignal
  )

  if (getPluginIsManaged() === null || shouldShowNews("rojo7", context)) {
    createOrShowInterface(context, getBridge)
  }
}

export function deactivate() {
  Rojo.stopAll() // Attempting to shut all the random instances down
  console.log('"vscode-rojo" has deactivated.')
}

export const outputChannel = vscode.window.createOutputChannel(
  `Rojo: Installation`
)
export const sendToOutput = (data: string | Buffer) =>
  outputChannel.append(data.toString())
