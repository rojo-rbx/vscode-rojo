import vscode from "vscode"
import { pickRojo } from "../util/pickRojo"

/**
 * Rojo: Convert from 0.4.x to 0.5.x command.
 */
export const convertCommand = vscode.commands.registerCommand(
  "rojo.convert",
  async () => {
    const rojo = await pickRojo({
      noFoldersError:
        "You must open a workspace folder to convert configurations.",
      prompt: "Select a folder to convert rojo.json from.",
      allowUninitialized: true
    })

    if (!rojo) return

    rojo.attemptUpgrade()
  }
)
