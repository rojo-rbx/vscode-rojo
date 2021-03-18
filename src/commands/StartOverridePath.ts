import vscode from "vscode"
import { startRojo } from "../util/startRojo"

/**
 * Rojo: Start server command with project file path override. Prompts user for a file path, then calls `rojo.exe serve`
 */
export const startOverridePathCommand = vscode.commands.registerCommand(
  "rojo.startOverridePath",
  async () => startRojo(true)
)
