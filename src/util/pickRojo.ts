import vscode from "vscode"
import { extensionContext } from "../extension"
import { Rojo } from "../Rojo"
import { pickFolder, pickProjectFile } from "../Util"
import { getBridge, resetBridge } from "./getBridge"

export enum PickRojoMode {
  Prompt,
  LastUsed
}

export interface PickRojoOptions {
  noFoldersError: string
  prompt: string
  allowUninitialized?: boolean
  pickMode?: PickRojoMode
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

  const versionInfo = bridge.getVersionInfo()

  // Only pick workspace folder if we know there aren't any files to pick from.
  if (options.allowUninitialized) {
    const workspaceFolder = await pickFolder(folders, options.prompt)

    if (!workspaceFolder) return

    return bridge.getRojo(
      workspaceFolder,
      vscode.workspace.asRelativePath(versionInfo.getProjectFileName(), false)
    )
  }

  // Check if we have a valid last used path
  if (options.pickMode === PickRojoMode.LastUsed) {
    const lastFilePath:
      | string
      | undefined = extensionContext.workspaceState.get("rojoLastPath")

    if (lastFilePath) {
      try {
        const uri = vscode.Uri.parse(lastFilePath)

        // This throws if the file doesn't exist
        await vscode.workspace.fs.stat(uri)

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)

        if (workspaceFolder) {
          return bridge.getRojo(
            workspaceFolder,
            vscode.workspace.asRelativePath(uri, false)
          )
        }
      } catch (e) {
        // fall through
      }
    }
  }

  // Let the user pick which project file they want to use from all possible roots.
  const path = await pickProjectFile(folders, options.prompt)
  if (path === null) {
    // User cancelled prompt
    return
  } else if (!path) {
    // No files exist

    const upgradeAvailable = versionInfo.isUpgraderAvailable(
      folders[0].uri.fsPath
    )

    vscode.window
      .showErrorMessage(
        "There are no project files in this workspace. Do you want to initialize one now?",
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

  extensionContext.workspaceState.update("rojoLastPath", path.toString(true))

  const relativePath = vscode.workspace.asRelativePath(path, false)

  // All checks passed, so we return the actual Rojo instance.
  return bridge.getRojo(
    vscode.workspace.getWorkspaceFolder(path)!,
    relativePath
  )
}
