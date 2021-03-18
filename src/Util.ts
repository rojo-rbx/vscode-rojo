import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { Duplex } from "stream"
import * as vscode from "vscode"
import { Bridge } from "./Bridge"
import Interface from "./Interface"

export function getConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("rojo")
}

export function expandEnvironmentVars(input: string): string {
  return input.replace(/\$[\w]+/g, function(match: string) {
    return process.env[match.replace("$", "")] || match
  })
}

export function getLocalPluginPath(): string {
  let pluginsPath = getConfiguration().get("robloxStudioPluginsPath") as string
  if (!pluginsPath || pluginsPath.length === 0) {
    if (os.platform() === "win32") {
      pluginsPath = "$LOCALAPPDATA/Roblox/Plugins"
    } else {
      pluginsPath = "$HOME/Documents/Roblox/Plugins"
    }
  }
  return path.resolve(expandEnvironmentVars(pluginsPath))
}

export function getCargoPath(): string {
  return expandEnvironmentVars(getConfiguration().get("cargo") as string)
}

export function getPluginIsManaged(): boolean | null {
  return getConfiguration().get("pluginManagement") as boolean | null
}

export function setPluginIsManaged(isManaged: boolean): void {
  getConfiguration().update("pluginManagement", isManaged, true)
}

export function getTargetVersion(): string | undefined {
  return getConfiguration().get("targetVersion")
}

export function getReleaseBranch(): string | undefined {
  return getConfiguration().get("releaseBranch")
}

export function getProjectFilePath(): string | undefined {
  return getConfiguration().get("projectFilePath")
}

export function updateProjectFilePath(
  value: string,
  target?: vscode.ConfigurationTarget | boolean
) {
  return getConfiguration().update("projectFilePath", value, target)
}

export function isTelemetryEnabled(): boolean {
  return getConfiguration().get("enableTelemetry") as boolean
}

export function shouldShowNews(
  news: string,
  context: vscode.ExtensionContext
): boolean {
  const key = `news::${news}`
  const hasSeen = context.globalState.get(key)

  if (!hasSeen) {
    context.globalState.update(key, true)
  }

  return !hasSeen
}

let currentInterface: Interface | undefined
export function createOrShowInterface(
  context: vscode.ExtensionContext,
  getBridge: () => Promise<Bridge | undefined>
): void {
  if (currentInterface) {
    currentInterface.panel.reveal()
    return
  }

  currentInterface = new Interface(context, getBridge)
  currentInterface.panel.onDidDispose(() => {
    // Get rid of our reference if the user closes the webview
    currentInterface = undefined
  })

  context.subscriptions.push(currentInterface)
}

export function isInterfaceOpened(): boolean {
  return currentInterface != null
}

/**
 * A utility function that takes a stream and converts it into a promise.
 * Resolves on stream end, or rejects on stream error.
 * @param {fs.WriteStream} stream The stream to promisify
 * @returns {Promise<any>} A promise that resolves or rejects based on the status of the stream.
 */
export function promisifyStream(
  stream: fs.ReadStream | fs.WriteStream | Duplex
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    stream.on("close", resolve)
    stream.on("finish", resolve)
    stream.on("end", resolve)
    stream.on("error", reject)
  })
}

interface WorkspaceFolderItem extends vscode.QuickPickItem {
  folder: vscode.WorkspaceFolder
}

/**
 * Creates a picker menu so that the user can select which workspace root folder they want to use.
 * If there's only one root, it will return instantly with that folder.
 * @param {vscode.WorkspaceFolder[]} folders The list of WorkspaceFolders to pick from.
 * @param {string} placeHolder The prompt that's in the box so the user knows what's up.
 * @returns {(Thenable<vscode.WorkspaceFolder | undefined>)} The chosen folder, or undefined if it was closed.
 */
export function pickFolder(
  folders: vscode.WorkspaceFolder[],
  placeHolder: string
): Thenable<vscode.WorkspaceFolder | undefined> {
  if (folders.length === 1) {
    return Promise.resolve(folders[0])
  }
  return vscode.window
    .showQuickPick(
      folders.map<WorkspaceFolderItem>(folder => {
        return {
          label: folder.name,
          description: folder.uri.fsPath,
          folder: folder
        }
      }),
      { placeHolder: placeHolder }
    )
    .then(selected => {
      if (!selected) {
        return undefined
      }
      return selected.folder
    })
}

export function callWithCounter<T extends unknown[]>(
  callback: (count: number, ...args: T) => unknown
) {
  let count = 0

  return (...args: T) => {
    callback(count++, ...args)
  }
}
