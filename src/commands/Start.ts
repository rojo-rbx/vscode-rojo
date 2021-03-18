import vscode from "vscode"
import { startRojo } from "../util/startRojo"

/**
 * Rojo: Start server command. Calls `rojo.exe serve` and watches rojo.json for file changes.
 */
export const startCommand = vscode.commands.registerCommand(
  "rojo.start",
  async () => startRojo(false)
)
