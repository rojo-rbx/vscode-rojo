import * as childProcess from "child_process"
import * as vscode from "vscode"
import { State } from "./extension"
import { ProjectFile } from "./findProjectFiles"
import { updateButton } from "./updateButton"
import { formatProjectDisplayName } from "./projectDisplay"
import path = require("path")

export type RunningProject = {
  stop: () => void
  projectFile: ProjectFile
}

export function serveProject(state: State, projectFile: ProjectFile) {
  const projectFilePath = projectFile.path.fsPath

  state.context.workspaceState.update("rojoLastPath", projectFilePath)

  if (state.running[projectFilePath]) {
    throw new Error("This project is already running")
  }

  const projectFileFolder = path.dirname(projectFilePath)

  const outputChannel = vscode.window.createOutputChannel(
    `Rojo: ${formatProjectDisplayName(projectFile)}`
  )

  const child = childProcess.spawn(
    "rojo",
    ["serve", path.basename(projectFilePath), "--color", "never"],
    {
      cwd: projectFileFolder,
    }
  )

  {
    let count = 0
    child.stdout.on("data", (data) => {
      count++

      if (count === 1) {
        vscode.window.showInformationMessage(data.toString())
      } else if (count === 2) {
        outputChannel.show()
      }

      outputChannel.append(data.toString())
    })
  }

  {
    let count = 0

    child.stderr.on("data", (data) => {
      count++
      outputChannel.append(data.toString())

      if (count === 1) {
        outputChannel.show()
      }
    })
  }

  child.on("exit", (code) => {
    if (code && code !== 0) {
      outputChannel.show()
    }

    delete state.running[projectFilePath]
    updateButton(state)
  })

  console.log("Child process pid is", child.pid)

  state.running[projectFilePath] = {
    projectFile,
    stop() {
      const killSuccessful = child.kill()
      if (!killSuccessful) {
        console.error("Could not kill process")
      }

      console.log(`Stopped ${projectFilePath}`)
    },
  }

  updateButton(state)
}
