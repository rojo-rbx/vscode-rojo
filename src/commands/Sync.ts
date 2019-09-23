import vscode from "vscode"
import { VALID_SERVICES } from "../Strings"
import { pickRojo } from "../util/pickRojo"

export const createPartitionCommand = vscode.commands.registerCommand(
  "rojo.createPartition",
  async (uri?: vscode.Uri) => {
    if (uri == null) return

    const rojo = await pickRojo({
      prompt: "Select a workspace to create the partition in.",
      noFoldersError:
        "Rojo can only start if VS Code is opened on a workspace folder."
    })

    if (!rojo) return

    const target = await vscode.window.showInputBox({
      prompt:
        "Enter the Roblox target for this partition. (Example: ReplicatedStorage.My Code)",
      validateInput: input => {
        if (!rojo.shouldSyncPathBeginWithService()) {
          return
        }
        if (input.startsWith("game.")) {
          return 'Partition targets should omit "game", and begin with the top-level service. For example, "ReplicatedStorage.Folder" is valid.'
        } else if (VALID_SERVICES.indexOf(input.split(".")[0]) === -1) {
          return "Partition targets must begin with a valid Service (such as ReplicatedStorage or ServerScriptService)"
        }
      }
    })

    if (!target) return

    rojo.createSyncPoint(uri.fsPath, target)
    rojo.openConfiguration()
  }
)
