import vscode from "vscode"
import { pickRojo } from "../util/pickRojo"

/**
 * Rojo: Build a place/model file using the provided project file path
 */
export const buildOverridePathCommand = vscode.commands.registerCommand(
  "rojo.buildOverridePath",
  async () => {
    const rojo = await pickRojo({
      noFoldersError: "You must open a workspace folder to build.",
      prompt: "Select a folder to build.",
      promptForProjectFilePath: true
    })

    if (!rojo) return

    await rojo.build()
  }
)
