import os from "os"
import vscode from "vscode"
import { statusButton } from "../extension"
import { ButtonState } from "../StatusButton"
import Telemetry, { TelemetryEvent } from "../Telemetry"
import { getBridge } from "../util/getBridge"
import { pickRojo } from "../util/pickRojo"

/**
 * Starts a new rojo serve instance. Used for the `rojo.start` and `rojo.startOverridePath` commands.
 * @param projectFilePath An optional override path to the project file we should use
 * @returns
 */
export async function startRojo(promptForProjectFilePath: boolean) {
  try {
    const bridge = await getBridge()
    // Get the correct Rojo instance the user wants to start.
    const rojo = await pickRojo({
      noFoldersError:
        "Rojo can only start if VS Code is opened on a workspace folder.",
      prompt: "Select a workspace to start Rojo in.",
      promptForProjectFilePath
    })
    // Will be undefined if user closed the box
    if (!rojo || !bridge) return

    try {
      // Wrapped in a try/catch because child_process.spawn can get some strange errors sometimes (like EBUSY)
      rojo.serve()
    } catch (e) {
      console.log(e)
      Telemetry.trackEvent(
        TelemetryEvent.RuntimeError,
        "Rojo spawn exception",
        os.platform()
      )
      Telemetry.trackException(e)
      vscode.window.showErrorMessage(
        `An error occurred while spawning Rojo: ${e}`
      )
      return
    }
    // One final check to make sure that `rojo.serving` is true. If it's not, something caused the serve function to stop prematurely.
    if (!rojo.serving) {
      vscode.window.showErrorMessage("An error occurred while spawning Rojo.")
      Telemetry.trackEvent(
        TelemetryEvent.RuntimeError,
        "Rojo not serving",
        os.platform()
      )
    }

    // Add the saved Rojo version to the button while setting it to Running.
    statusButton.setState(
      ButtonState.Running,
      bridge.version,
      rojo.getProjectFilePath()
    )
  } catch (e) {
    vscode.window.showErrorMessage(
      `An error occurred while starting Rojo: ${e}`
    )
  }
}
