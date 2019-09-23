import vscode from "vscode"
import { pickRojo } from "../util/pickRojo"

/**
 * Rojo: Convert from 0.4.x to 0.5.x command.
 */
export const buildCommand = vscode.commands.registerCommand(
  "rojo.build",
  async () => {
    const rojo = await pickRojo({
      noFoldersError: "You must open a workspace folder to build.",
      prompt: "Select a folder to build."
    })

    if (!rojo) return

    await rojo.build()
  }
)
