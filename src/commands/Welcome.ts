import vscode from "vscode"
import { extensionContext } from "../extension"
import { createOrShowInterface } from "../Util"
import { getBridge } from "../util/getBridge"

/**
 * Rojo: Show welcome screen.
 */
export const welcomeCommand = vscode.commands.registerCommand(
  "rojo.welcome",
  () => createOrShowInterface(extensionContext, getBridge)
)
