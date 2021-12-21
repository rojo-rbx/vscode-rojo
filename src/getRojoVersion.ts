import * as childProcess from "child_process"
import { promisify } from "util"
import { ProjectFile } from "./findProjectFiles"
import path = require("path")

const exec = promisify(childProcess.exec)

export async function getRojoVersion(
  projectFile: ProjectFile
): Promise<string | null> {
  const projectFilePath = projectFile.path.fsPath
  const projectFileFolder = path.dirname(projectFilePath)

  const output = await exec("rojo --version", {
    cwd: projectFileFolder,
  }).catch(() => null)

  if (output) {
    if (output.stderr.length > 0) {
      console.error("Rojo version resulted in stderr output")
      return null
    }

    const split = output.stdout.split(" ")

    const version = split[1]

    if (!version) {
      return null
    }

    return version
  } else {
    return null
  }
}
