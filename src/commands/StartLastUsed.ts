import vscode from "vscode"
import { PickRojoMode } from "../util/pickRojo"
import { startRojo } from "../util/startRojo"

/**
 * Rojo: Start server command with project file path override. Prompts user for a file path, then calls `rojo.exe serve`
 */
export const startLastUsed = vscode.commands.registerCommand(
  "rojo.startLastUsed",
  async () => startRojo(PickRojoMode.LastUsed)
)
