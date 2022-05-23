import * as childProcess from "child_process"
import { promisify } from "util"
import * as vscode from "vscode"
import { ProjectFile } from "./findProjectFiles"
import path = require("path")

const exec = promisify(childProcess.exec)

export async function installPlugin(projectFile: ProjectFile) {
  const projectFilePath = projectFile.path.fsPath
  const projectFileFolder = path.dirname(projectFilePath)

  const output = await exec(`rojo plugin install`, {
    cwd: projectFileFolder,
  })

  if (output.stderr.length > 0) {
    vscode.window.showErrorMessage("Rojo plugin install failed: " + output)
  } else {
    vscode.window.showInformationMessage(
      "Rojo: " +
        (output.stdout.length > 0
          ? output.stdout
          : "Roblox Studio plugin installed!")
    )
  }
}
