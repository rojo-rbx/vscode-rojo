import vscode from "vscode"
import { pickRojo } from "../util/pickRojo"

/**
 * Rojo: Initialize command. Calls `rojo.exe init` under the hood.
 */
export const initCommand = vscode.commands.registerCommand(
  "rojo.init",
  async () => {
    // Get the correct Rojo instance the user wants to initialize.
    const rojo = await pickRojo({
      noFoldersError:
        "A Rojo configuration can only be generated if VS Code is opened on a workspace folder.",
      prompt: "Select a workspace to initialize Rojo in.",
      allowUninitialized: true
    })
    // Will be undefined if user closed the box
    if (!rojo) return

    rojo.init()
  }
)
