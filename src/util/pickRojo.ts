import fs from "fs"
import path from "path"
import vscode from "vscode"
import { Rojo } from "../Rojo"
import { pickFolder } from "../Util"
import { getBridge, resetBridge } from "./getBridge"

export interface PickRojoOptions {
  noFoldersError: string
  prompt: string
  allowUninitialized?: boolean
}

/**
 * This function is an extension of the pickFolder function; it returns a Rojo instance based on what
 * workspace root the user chooses, or undefined if the prompt was closed. Options let the caller provide
 * error messages and prompt message, as well as if things should still work even if a rojo.json is missing.
 * @param {PickRojoOptions} options The options for this specific picker.
 * @returns {Promise<Rojo | undefined>} The Rojo instance for the picked folder, or undefined if the prompt was closed.
 */
export async function pickRojo(
  options: PickRojoOptions
): Promise<Rojo | undefined> {
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
  if (!bridge) {
    resetBridge()
    return
  }

  // Ask the user to pick which workspace root folder to start Rojo in. If the workspace only has one folder,
  // this returns instantly with that folder. If it's undefined, the user closed the box.
  const folder = await pickFolder(folders, options.prompt)
  if (!folder) return

  // Ensure `rojo.json` exists in the workspace unless allowUnitialized is true.

  const partialVersion = bridge.getPartialVersion()
  const projectFileName = partialVersion.getProjectFileName()

  if (
    !options.allowUninitialized &&
    !fs.existsSync(path.join(folder.uri.fsPath, projectFileName))
  ) {
    const upgradeAvailable = partialVersion.isUpgraderAvailable(
      folder.uri.fsPath
    )

    vscode.window
      .showErrorMessage(
        `${projectFileName} is missing from this workspace.`,
        ...["Initialize", ...(upgradeAvailable ? ["Convert rojo.json"] : [])]
      )
      .then(button => {
        switch (button) {
          case "Initialize":
            vscode.commands.executeCommand("rojo.init")
            break
          case "Convert rojo.json":
            vscode.commands.executeCommand("rojo.convert")
            break
        }
      })
    return
  }

  // All checks passed, so we return the actual Rojo instance.
  return bridge.getRojo(folder)
}
