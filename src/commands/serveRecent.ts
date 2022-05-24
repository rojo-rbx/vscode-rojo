import * as path from "path"
import * as vscode from "vscode"
import { State } from "../extension"
import { serveProject } from "../serveProject"

export const serveRecentCommand = (state: State) =>
  vscode.commands.registerCommand("vscode-rojo.serveRecent", async () => {
    const lastFilePath: string | undefined =
      state.context.workspaceState.get("rojoLastPath")

    if (lastFilePath) {
      try {
        const uri = vscode.Uri.file(lastFilePath)

        // This throws if the file doesn't exist
        await vscode.workspace.fs.stat(uri)

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)

        if (workspaceFolder) {
          return serveProject(state, {
            name: path.basename(lastFilePath),
            workspaceFolderName: workspaceFolder.name,
            path: uri,
          })
        }
      } catch (e) {
        // fall through
      }
    }

    vscode.commands.executeCommand("vscode-rojo.openMenu")
  })
