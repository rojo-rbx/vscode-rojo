import * as childProcess from "child_process"
import { promisify } from "util"
import * as vscode from "vscode"

const exec = promisify(childProcess.exec)

export async function createProjectFile(folder: string) {
  const output = await exec("rojo init", {
    cwd: folder,
  })

  if (output.stderr.length > 0) {
    vscode.window.showErrorMessage(output.stderr)
  }
}
