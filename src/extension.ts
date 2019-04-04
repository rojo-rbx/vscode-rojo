import * as fs from 'fs'
import * as childProcess from 'child_process'
import * as os from 'os'
import * as path from 'path'
import * as vscode from 'vscode'
import BridgeFactory from './Bridge'
import { Rojo } from './Rojo'
import StatusButton, { ButtonState } from './StatusButton'
import { createOrShowInterface, getPluginIsManaged, pickFolder, shouldShowNews } from './Util'
import Telemetry, { TelemetryEvent } from './Telemetry'
import { VALID_SERVICES, CONFIG_NAME_05 } from './Strings'

interface PickRojoOptions {
  noFoldersError: string,
  prompt: string,
  allowUninitialized?: boolean
}

/**
 * The main extension activation function that is called by VS Code when the extension starts.
 * @export
 * @param {vscode.ExtensionContext} context The ExtensionContext provided by VS Code.
 */
export function activate (context: vscode.ExtensionContext) {
  console.log('"vscode-rojo" is now active!')
  console.log(`Storage directory: ${context.extensionPath}`)

  // context.globalState.update('rojoFetched', undefined)
  // context.globalState.update('rojoVersion', undefined)

  Telemetry.initialize(context)

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
    if (!options.allowUninitialized && !fs.existsSync(path.join(folder.uri.fsPath, bridge.getConfigFileName()))) {
      vscode.window.showErrorMessage('Configuration file is missing from this workspace.', 'Create now')
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

  /**
   * Rojo: Convert from 0.4.x to 0.5.x command.
   */
  const convertCommand = vscode.commands.registerCommand('rojo.convert', async () => {
    const rojo = await pickRojo({
      noFoldersError: 'You must open a workspace folder to convert configurations.',
      prompt: 'Select a folder to convert rojo.json from.',
      allowUninitialized: true
    })

    if (!rojo) return

    if (fs.existsSync(path.join(rojo.workspacePath, CONFIG_NAME_05))) {
      vscode.window.showErrorMessage('default.project.json already exists in this workspace.')
      return
    }

    rojo.sendToOutput('Converting...', true)

    const output = childProcess.execSync('npx rojo-convert', {
      cwd: rojo.workspacePath,
      encoding: 'utf8'
    })

    rojo.sendToOutput(output || 'Converted')
  })

  /**
   * Rojo: Convert from 0.4.x to 0.5.x command.
   */
  const buildCommand = vscode.commands.registerCommand('rojo.build', async () => {
    const rojo = await pickRojo({
      noFoldersError: 'You must open a workspace folder to build.',
      prompt: 'Select a folder to build.'
    })

    if (!rojo) return

    await rojo.build()
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
      Telemetry.trackEvent(TelemetryEvent.RuntimeError, 'Rojo spawn exception', os.platform())
      Telemetry.trackException(e)
      vscode.window.showErrorMessage('An error occurred while spawning Rojo.')
      return
    }
    // One final check to make sure that `rojo.serving` is true. If it's not, something caused the serve function to stop prematurely.
    if (!rojo.serving) {
      vscode.window.showErrorMessage('An error occurred while spawning Rojo.')
      Telemetry.trackEvent(TelemetryEvent.RuntimeError, 'Rojo not serving', os.platform())
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

  const createPartitionCommand = vscode.commands.registerCommand('rojo.createPartition', async (uri?: vscode.Uri) => {
    if (uri == null) return

    const rojo = await pickRojo({
      prompt: 'Select a workspace to create the partition in.',
      noFoldersError: 'Rojo can only start if VS Code is opened on a workspace folder.'
    })

    if (!rojo) return

    const target = await vscode.window.showInputBox({
      prompt: 'Enter the Roblox target for this partition. (Example: ReplicatedStorage.My Code)',
      validateInput: input => {
        if (input.startsWith('game.')) {
          return 'Partition targets should omit "game", and begin with the top-level service. For example, "ReplicatedStorage.Folder" is valid.'
        } else if (VALID_SERVICES.indexOf(input.split('.')[0]) === -1) {
          return 'Partition targets must begin with a valid Service (such as ReplicatedStorage or ServerScriptService)'
        }
      }
    })

    if (!target) return

    rojo.createPartition(uri.fsPath, target)
    rojo.openConfiguration()
  })

  /**
   * Rojo: Show welcome screen.
   */
  const welcomeCommand = vscode.commands.registerCommand('rojo.welcome', () => createOrShowInterface(context, getBridge))

  // Tell VS Code about our disposable commands so they get cleaned up when VS Code reloads.
  // TODO: Add our own disposables here too
  context.subscriptions.push(initCommand, startCommand, stopCommand, welcomeCommand, createPartitionCommand, convertCommand, buildCommand)

  if (getPluginIsManaged() === null || shouldShowNews('rojo0.5support', context)) {
    createOrShowInterface(context, getBridge)
  }
}

export function deactivate () {
  console.log('"vscode-rojo" has deactivated.')
}
