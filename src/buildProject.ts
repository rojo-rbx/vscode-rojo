import * as childProcess from "child_process"
import * as fs from "fs/promises"
import { promisify } from "util"
import * as vscode from "vscode"
import { ProjectFile } from "./findProjectFiles"
import path = require("path")

const exec = promisify(childProcess.exec)

export async function buildProject(projectFile: ProjectFile) {
  const projectFilePath = projectFile.path.fsPath
  const projectFileFolder = path.dirname(projectFilePath)

  const config = JSON.parse(
    await fs.readFile(projectFilePath, { encoding: "utf-8" })
  )

  const name = config.name || "build"
  const isPlace =
    (config && config.tree && config.tree.$className === "DataModel") || false
  const artifactName = `${name}.${isPlace ? "rbxl" : "rbxm"}`

  const output = await exec(
    `rojo build "${path.basename(projectFilePath)}" --output "${artifactName}"`,
    {
      cwd: projectFileFolder,
    }
  )

  if (output.stderr.length > 0) {
    vscode.window.showErrorMessage("Rojo build failed: " + output.stderr)
  } else {
    vscode.window.showInformationMessage("Rojo: " + output.stdout)
  }
}
