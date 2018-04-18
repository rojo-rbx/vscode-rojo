import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import BridgeFactory from './Bridge'
import { Rojo } from './Rojo'
import StatusButton, { ButtonState } from './StatusButton'

interface WorkspaceFolderItem extends vscode.QuickPickItem {
  folder: vscode.WorkspaceFolder
}

function pickFolder (folders: vscode.WorkspaceFolder[], placeHolder: string): Thenable<vscode.WorkspaceFolder | undefined> {
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

export function activate (context: vscode.ExtensionContext) {
  console.log('"vscode-rojo" is now active!')

  const statusButton = new StatusButton()

  const getBridge = BridgeFactory(context, statusButton)

  const pickRojo = async (options: {noFoldersError: string, prompt: string, allowUninitialized?: boolean}) => {
    const folders = vscode.workspace.workspaceFolders

    if (!folders) {
      vscode.window.showErrorMessage(options.noFoldersError)
      return
    }

    const bridge = await getBridge()
    if (!bridge.ready) return console.log('Bridge not ready')

    const folder = await pickFolder(folders, options.prompt)
    if (!folder) return

    if (!options.allowUninitialized && !fs.existsSync(path.join(folder.uri.fsPath, 'rojo.json'))) {
      vscode.window.showErrorMessage('rojo.json is missing from this workspace.', 'Create now')
      .then(init => {
        if (init) {
          vscode.commands.executeCommand('rojo.init')
        }
      })
      return
    }

    return bridge.getRojo(folder)
  }

  const initCommand = vscode.commands.registerCommand('rojo.init', async () => {
    const rojo = await pickRojo({
      noFoldersError: 'A Rojo configuration can only be generated if VS Code is opened on a workspace folder.',
      prompt: 'Select a workspace to initialize Rojo in.',
      allowUninitialized: true
    })
    if (!rojo) return

    rojo.init()
  })

  const rojoStack: Rojo[] = []

  const startCommand = vscode.commands.registerCommand('rojo.start', async () => {
    const rojo = await pickRojo({
      noFoldersError: 'Rojo can only start if VS Code is opened on a workspace folder.',
      prompt: 'Select a workspace to start Rojo in.'
    })
    if (!rojo) return

    try {
      rojo.serve()
    } catch (e) {
      console.log(e)
      vscode.window.showErrorMessage('An error occurred while spawning Rojo.')
      return
    }
    if (!rojo.serving) {
      vscode.window.showErrorMessage('An error occurred while spawning Rojo.')
    }
    rojoStack.push(rojo)

    statusButton.setState(ButtonState.Running, (await getBridge()).version)
  })

  const stopCommand = vscode.commands.registerCommand('rojo.stop', () => {
    if (rojoStack.length > 0) {
      (rojoStack.pop() as Rojo).stop()
    }

    if (rojoStack.length === 0) {
      statusButton.setState(ButtonState.Start)
    }
  })

  context.subscriptions.push(initCommand, startCommand, stopCommand)
}

export function deactivate () {
  console.log('Deactivate.')
}
