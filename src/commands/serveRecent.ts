import * as path from "path"
import * as vscode from "vscode"
import { State } from "../extension"
import { getRojoInstall } from "../getRojoInstall"
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
          const projectFile = {
            name: path.basename(lastFilePath),
            workspaceFolderName: workspaceFolder.name,
            path: uri,
          }

          const install = await getRojoInstall(projectFile)

          if (install) {
            return serveProject(state, projectFile)
          }
        }
      } catch (e) {
        // fall through
      }
    }

    vscode.commands.executeCommand("vscode-rojo.openMenu")
  })
