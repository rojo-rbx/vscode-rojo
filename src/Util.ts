import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'
import Interface from './Interface'
import { Bridge } from './Bridge'

export function getConfiguration (): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('rojo')
}

export function getLocalPluginPath (): string {
  return path.resolve(expandenv(getConfiguration().get('robloxStudioPluginsPath') as string))
}

export function getCargoPath (): string {
  return expandenv(getConfiguration().get('cargo') as string)
}

export function expandenv(input: string): string {
  return input.replace(/\$[\w]+/g, function(match: string) {
    return process.env[match.replace('$', '')] || match
  })
}

export function getPluginIsManaged (): boolean | null {
  return getConfiguration().get('pluginManagement') as boolean | null
}

export function setPluginIsManaged (isManaged: boolean): void {
  getConfiguration().update('pluginManagement', isManaged, true)
}

export function isTelemetryEnabled (): boolean {
  return getConfiguration().get('enableTelemetry') as boolean
}

let currentInterface: Interface | undefined
export function createOrShowInterface (context: vscode.ExtensionContext, getBridge: () => Promise<Bridge>): void {
  if (currentInterface) {
    currentInterface.panel.reveal()
    return
  }

  currentInterface = new Interface(context, getBridge)
  currentInterface.panel.onDidDispose(e => {
    // Get rid of our reference if the user closes the webview
    currentInterface = undefined
  })

  context.subscriptions.push(currentInterface)
}

export function isInterfaceOpened (): boolean {
  return currentInterface != null
}

/**
 * A utility function that takes a stream and converts it into a promise.
 * Resolves on stream end, or rejects on stream error.
 * @param {fs.WriteStream} stream The stream to promisify
 * @returns {Promise<any>} A promise that resolves or rejects based on the status of the stream.
 */
export function promisifyStream (stream: fs.WriteStream): Promise<any> {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve)
    stream.on('error', reject)
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
export function pickFolder (folders: vscode.WorkspaceFolder[], placeHolder: string): Thenable<vscode.WorkspaceFolder | undefined> {
  if (folders.length === 1) {
    return Promise.resolve(folders[0])
  }
  return vscode.window.showQuickPick(
		folders.map<WorkspaceFolderItem>((folder) => { return { label: folder.name, description: folder.uri.fsPath, folder: folder } }),
		{ placeHolder: placeHolder }
	).then((selected) => {
  if (!selected) {
    return undefined
  }
  return selected.folder
})
}
