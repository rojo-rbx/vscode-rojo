import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import BridgeFactory from './Bridge'
import { Rojo } from './Rojo'
import StatusButton, { ButtonState } from './StatusButton'

interface WorkspaceFolderItem extends vscode.QuickPickItem {
  folder: vscode.WorkspaceFolder
}

interface PickRojoOptions {
  noFoldersError: string,
  prompt: string,
  allowUninitialized?: boolean
}

/**
 * Creates a picker menu so that the user can select which workspace root folder they want to use.
 * If there's only one root, it will return instantly with that folder.
 * @param {vscode.WorkspaceFolder[]} folders The list of WorkspaceFolders to pick from.
 * @param {string} placeHolder The prompt that's in the box so the user knows what's up.
 * @returns {(Thenable<vscode.WorkspaceFolder | undefined>)} The chosen folder, or undefined if it was closed.
 */
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

/**
 * The main exetension activation function that is called by VS Code when the extenion starts.
 * @export
 * @param {vscode.ExtensionContext} context The ExtensionContext provided by VS Code.
 */
export function activate (context: vscode.ExtensionContext) {
  console.log('"vscode-rojo" is now active!')
  console.log(`Storage directory: ${context.extensionPath}`)

  const statusButton = new StatusButton()

  const getBridge = BridgeFactory(context, statusButton)

  /**
   * This function is an extension of the pickFolder function; it returns a Rojo instance based on what
   * workspace root the user chooses, or undefined if the prompt was closed. Options let the caller provide
   * error messages and prompt message, as well as if things should still work even if a rojo.json is missing.
   * @param {PickRojoOptions} options The options for this specific picker.
   * @returns {Promise<Rojo | undefined>} The Rojo instance for the picked folder, or undefined if the prompt was closed.
   */
  const pickRojo = async (options: PickRojoOptions): Promise<Rojo | undefined> => {
    const folders = vscode.workspace.workspaceFolders

    // If there are no folders in the workspace at all (e.g., opened a single file)
    if (!folders) {
      vscode.window.showErrorMessage(options.noFoldersError)
      return
    }

    // Instantiate the bridge. This will cause Rojo to be installed when the promise comes back.
    // If `bridge.ready` is still false after the promise comes back, then that means installation failed.
    // The bridge makes its own error messages, so we just bail out here.
    const bridge = await getBridge()
    if (!bridge.ready) return

    // Ask the user to pick which workspace root folder to start Rojo in. If the workspace only has one folder,
    // this returns instantly with that folder. If it's undefined, the user closed the box.
    const folder = await pickFolder(folders, options.prompt)
    if (!folder) return

    // Ensure `rojo.json` exists in the workspace unless allowUnitialized is true.
    if (!options.allowUninitialized && !fs.existsSync(path.join(folder.uri.fsPath, 'rojo.json'))) {
      vscode.window.showErrorMessage('rojo.json is missing from this workspace.', 'Create now')
      .then(createNow => {
        // createNow will be the string of the button text that they clicked.
        if (createNow) {
          vscode.commands.executeCommand('rojo.init')
        }
      })
      return
    }

    // All checks passed, so we return the actual Rojo instance.
    return bridge.getRojo(folder)
  }

  /**
   * Rojo: Initialize command. Calls `rojo.exe init` under the hood.
   */
  const initCommand = vscode.commands.registerCommand('rojo.init', async () => {
    // Get the correct Rojo instance the user wants to initialize.
    const rojo = await pickRojo({
      noFoldersError: 'A Rojo configuration can only be generated if VS Code is opened on a workspace folder.',
      prompt: 'Select a workspace to initialize Rojo in.',
      allowUninitialized: true
    })
    // Will be undefined if user closed the box
    if (!rojo) return

    rojo.init()
  })

  // A stack used for managing the button state. This way, if the user manually starts multiple instances of Rojo,
  // the button will only switch back to "Start rojo" once all instances are stopped.
  const rojoStack: Rojo[] = []

  /**
   * Rojo: Start server command. Calls `rojo.exe serve` and watches rojo.json for file changes.
   */
  const startCommand = vscode.commands.registerCommand('rojo.start', async () => {
    // Get the correct Rojo instance the user wants to start.
    const rojo = await pickRojo({
      noFoldersError: 'Rojo can only start if VS Code is opened on a workspace folder.',
      prompt: 'Select a workspace to start Rojo in.'
    })
    // Will be undefined if user closed the box
    if (!rojo) return

    try {
      // Wrapped in a try/catch because child_process.spawn can get some strange errors sometimes (like EBUSY)
      rojo.serve()
    } catch (e) {
      console.log(e)
      vscode.window.showErrorMessage('An error occurred while spawning Rojo.')
      return
    }
    // One final check to make sure that `rojo.serving` is true. If it's not, something caused the serve function to stop prematurely.
    if (!rojo.serving) {
      vscode.window.showErrorMessage('An error occurred while spawning Rojo.')
    }
    rojoStack.push(rojo)

    // Add the saved Rojo version to the button while setting it to Running.
    statusButton.setState(ButtonState.Running, (await getBridge()).version)
  })

  /**
   * Rojo: Stop server command. Kills the previously-running rojo.exe and closes the file watcher.
   */
  const stopCommand = vscode.commands.registerCommand('rojo.stop', () => {
    // If there's at least one Rojo instance running...
    if (rojoStack.length > 0) {
      (rojoStack.pop() as Rojo).stop()
    }

    // If there are no more Rojo instances running, reset the button back to the "Start" state.
    if (rojoStack.length === 0) {
      statusButton.setState(ButtonState.Start)
    }
  })

  // Tell VS Code about our disposable commands so they get cleaned up when VS Code reloads.
  // TODO: Add our own disposables here too
  context.subscriptions.push(initCommand, startCommand, stopCommand)
}

export function deactivate () {
  console.log('"vscode-rojo" has deactivated.')
}
