import axios from "axios"
import * as fs from "fs-extra"
import * as os from "os"
import * as path from "path"
import unzipper from "unzipper"
import * as vscode from "vscode"
import { outputChannel, sendToOutput } from "./extension"
import { Rojo } from "./Rojo"
import StatusButton, { ButtonState } from "./StatusButton"
import {
  BINARY_NAME,
  BINARY_PATTERN,
  PLUGIN_PATTERN,
  RELEASE_URL,
  ROJO_GIT_URL
} from "./Strings"
import Telemetry, { TelemetryEvent } from "./Telemetry"
import {
  getLocalPluginPath,
  getPluginIsManaged,
  getReleaseBranch,
  getTargetVersion,
  promisifyStream
} from "./Util"
import { getAppropriateVersionInfo } from "./versions"

interface GithubAsset {
  name: string
  content_type: string
  browser_download_url: string
}

/**
 * A bridge between our extension and Rojo, which handles installing, preparing, and giving access to Rojo.
 * @export
 * @class Bridge
 */
export class Bridge extends vscode.Disposable {
  public ready = false
  public version!: string
  public context: vscode.ExtensionContext
  private button: StatusButton
  public rojoPath!: string
  private rojoMap: Map<vscode.WorkspaceFolder, Rojo> = new Map()

  constructor(context: vscode.ExtensionContext, button: StatusButton) {
    super(() => this.dispose())

    // Store the extension context and status button for use later.
    this.context = context
    this.button = button

    // Attempt to load the version from our extension settings. This way, the
    // version number is preserved across Code restarts.
    // Sets to "unknown" if we've never downloaded Rojo before, but this gets re-set correctly in the installation methods.

    this.setVersion(
      getTargetVersion() ||
        this.context.globalState.get("rojoVersion") ||
        "unknown"
    )
  }

  /**
   * A static asynchronous bootstrapper for this class to allow instantiation to be `await`ed.
   * Calls and waits for the `prepare` method before returning the class.
   * @static
   * @param {vscode.ExtensionContext} context The extension context from the `activate` function.
   * @param {StatusButton} button An instance of our StatusButton class
   * @returns {Promise<Bridge>} A new Bridge which has been prepared.
   * @memberof Bridge
   */
  static async new(
    context: vscode.ExtensionContext,
    button: StatusButton
  ): Promise<Bridge | undefined> {
    const rojoBridge = new Bridge(context, button)
    await rojoBridge.prepare()
    return rojoBridge.ready ? rojoBridge : undefined
  }

  public get pluginPath() {
    // Rojo is sometimes released as rbxm, sometimes rbxmx.
    // Luckily, Studio doesn't rely on the file extension at all,
    // only that it's either rbxm or rbxmx.
    return path.join(getLocalPluginPath(), "rojo.rbxm")
  }

  public getVersionInfo() {
    return getAppropriateVersionInfo(this.version)
  }

  /**
   * Gets or creates the proper Rojo instance for the given workspace folder.
   * Only usable when the bridge is ready.
   * @param {vscode.WorkspaceFolder} workspace The workspace for which to get the Rojo instance.
   * @param {string} projectFile The path to the project file to use.
   * @returns {Rojo} The Rojo instance for the given workspace.
   * @memberof Bridge
   */
  public getRojo(workspace: vscode.WorkspaceFolder, projectFile: string): Rojo {
    if (!this.ready) {
      throw new Error("Attempt to get Rojo instance before bridge was ready")
    }

    if (!this.rojoMap.has(workspace)) {
      this.rojoMap.set(workspace, new Rojo(workspace, projectFile, this))
    }

    return (this.rojoMap.get(workspace) as Rojo).setProjectFilePath(projectFile)
  }

  /**
   * Forcefully reinstalls Rojo.
   * @returns {Promise<boolean>} Successful?
   * @memberof Bridge
   */
  public async reinstall(clearVersionCache = false): Promise<boolean> {
    if (clearVersionCache) {
      this.context.globalState.update("rojoFetched", undefined)
    }

    return this.install()
  }

  /**
   * Whether or not the local plugin is installed in the plugins folder.
   * @returns {boolean}
   * @memberof Bridge
   */
  public isPluginInstalled(): boolean {
    return fs.existsSync(this.pluginPath)
  }

  /**
   * Uninstalls the plugin from the plugins folder.
   * @returns {boolean} Successful?
   * @memberof Bridge
   */
  public uninstallPlugin(): boolean {
    if (this.isPluginInstalled()) {
      fs.unlinkSync(this.pluginPath)
      vscode.window.showInformationMessage(
        "Successfully uninstalled the local plugin from Roblox Studio."
      )
      return true
    }
    return false
  }

  /**
   * A method to safely dispose of all Rojo instances.
   * Called when the extension deactivates.
   * @memberof Bridge
   */
  public dispose(): void {
    for (const rojo of this.rojoMap.values()) {
      rojo.dispose()
    }

    this.ready = false
  }

  public getVersionString(): string {
    return this.version
  }

  private setVersion(version: string): void {
    this.version = version

    const storePath = this.context.globalStoragePath
    fs.ensureDirSync(storePath)

    this.rojoPath = path.join(
      storePath,
      `rojo-${version}${os.platform() === "win32" ? ".exe" : ""}`
    )
  }

  /**
   * A method called internally by the static `new` method that handles preparing the bridge for use,
   * including installation.
   * @private
   * @returns {Promise<void>} Resolves when the bridge has been prepared
   * @memberof Bridge
   */
  private async prepare(): Promise<void> {
    if (this.doesNeedInstall()) {
      this.ready = await this.install()
    } else {
      this.ready = true
    }
  }

  /**
   * A method that determines if Rojo needs to be installed (or updated), based on the current platform.
   * @private
   * @returns {boolean}
   * @memberof Bridge
   */
  private doesNeedInstall(): boolean {
    return true
    //// const lastFetched: number = this.context.globalState.get('rojoFetched') || 0
    //// return !fs.existsSync(this.rojoPath) || Date.now() - lastFetched > 3600000
  }

  /**
   * Determines the correct platform and then dispatches the installer for that platform.
   * @private
   * @returns {boolean} Successful?
   * @memberof Bridge
   */
  private async install(): Promise<boolean> {
    Telemetry.trackEvent(
      TelemetryEvent.Installation,
      "Before installation",
      os.platform()
    )

    return this.installRojoBinary()
  }

  /**
   * Installs the Studio plugin from a GitHub release.
   * @private
   * @param {GithubAsset[]} assets The assets from the GitHub release.
   * @returns {Promise<boolean>} Successful?
   * @memberof Bridge
   */
  private async installPlugin(assets: GithubAsset[]): Promise<boolean> {
    const plugin = assets.find(
      file =>
        file.name.match(PLUGIN_PATTERN) != null &&
        file.content_type === "application/octet-stream"
    )

    if (!plugin) {
      vscode.window.showWarningMessage(
        "Couldn't fetch latest Rojo plugin: couldn't finding a matching plugin file in the latest release."
      )
      Telemetry.trackEvent(
        TelemetryEvent.InstallationError,
        "Plugin not found",
        this.version
      )
      return false
    }

    await fs.ensureDir(path.dirname(this.pluginPath))

    this.button.setState(ButtonState.Downloading)

    const download = await axios.get(plugin.browser_download_url, {
      responseType: "stream"
    })
    const writeStream = fs.createWriteStream(this.pluginPath)

    download.data.pipe(writeStream)

    try {
      await promisifyStream(download.data)

      writeStream.close()
    } catch (e) {
      console.log(e)

      vscode.window.showErrorMessage(
        "Couldn't fetch latest Rojo plugin: an error ocurred while downloading the file."
      )
      Telemetry.trackEvent(
        TelemetryEvent.InstallationError,
        "Plugin download fail",
        this.version
      )
      Telemetry.trackException(e)
      return false
    }

    return true
  }

  private getBinaryZipPattern(): RegExp | undefined {
    switch (os.platform()) {
      case "win32":
        return /^rojo(?:-|-.*-)win64.zip$/
      case "darwin":
        return /^rojo(?:-|-.*-)macos.zip$/
      // case "linux":
      //   return /^rojo(?:-|-.*-)linux.zip$/
      default:
        return undefined
    }
  }

  private async installGitHubBinary(
    assets: GithubAsset[],
    version: string
  ): Promise<boolean> {
    const platform = os.platform()

    // Get the zip pattern to look for
    const zipPattern = this.getBinaryZipPattern()
    if (!zipPattern) {
      Telemetry.trackEvent(
        TelemetryEvent.InstallationError,
        "Platform not supported",
        platform
      )
      vscode.window.showErrorMessage(
        "Couldn't fetch Rojo: your platform is not supported."
      )
      this.button.setState(ButtonState.Start)
      return false
    }

    // Look for the binary we want.
    const binary = assets.find(
      file =>
        (platform == "win32" &&
          file.name === BINARY_NAME &&
          file.content_type === "application/x-msdownload") ||
        file.name.match(zipPattern) !== null
    )

    // If no matching file is found, just give up for now.
    if (!binary) {
      Telemetry.trackEvent(
        TelemetryEvent.InstallationError,
        "Binary not found",
        this.version
      )
      vscode.window.showErrorMessage(
        "Couldn't fetch latest Rojo: can't find a binary in the latest release. Try setting the targetVersion in extension settings."
      )
      this.button.setState(ButtonState.Start)
      return false
    }

    // Start the download of the binary as a stream
    const download = await axios.get(binary.browser_download_url, {
      responseType: "stream"
    })

    const writeStream = fs.createWriteStream(this.rojoPath)

    if (binary.name.endsWith(".zip")) {
      try {
        const unzip = download.data.pipe(unzipper.ParseOne(BINARY_PATTERN, {}))

        const file = unzip.pipe(writeStream)

        setTimeout(() => {
          console.log(unzip)
          console.log(file)
        }, 1000)

        await promisifyStream(unzip)

        if (file.bytesWritten === 0) {
          file.close()

          fs.unlinkSync(this.rojoPath)

          vscode.window.showErrorMessage(
            "rojo.exe missing from release ZIP file!"
          )
          this.button.setState(ButtonState.Start)
          return false
        } else {
          await promisifyStream(file)
        }
      } catch (e) {
        console.log(e)
        vscode.window.showErrorMessage(
          "Error ocurred while unzipping: " + e.toString()
        )
        this.button.setState(ButtonState.Start)
        return false
      }
    } else {
      try {
        download.data.pipe(writeStream)

        // Wait for the download to complete (or fail)
        await promisifyStream(download.data)

        // Important to close the stream since we're spawning the binary with child_process immediately afterwards.
        // If we don't close the stream, the file will still be marked as busy.
        writeStream.close()
      } catch (e) {
        console.log(e)
        Telemetry.trackEvent(
          TelemetryEvent.InstallationError,
          "Binary download fail",
          this.version
        )
        Telemetry.trackException(e)
        vscode.window.showErrorMessage(
          "Couldn't fetch latest Rojo: an error occurred while downloading the latest binary."
        )
        this.button.setState(ButtonState.Hidden)
        return false
      }
    }

    return true
  }

  /**
   * Rojo installer
   * @private
   * @returns {boolean} Successful?
   * @memberof Bridge
   */
  private async installRojoBinary(): Promise<boolean> {
    // TODO: Better support for button state when bailing out with returns
    // Update our user-facing button to indicate we're checking for an update.
    this.button.setState(ButtonState.Updating)

    // Fetch the latest release from Rojo's releases page.

    const targetVersion = getTargetVersion()
    const releaseBranch = getReleaseBranch()
    let release: any

    try {
      const options = { validateStatus: () => true }
      if (targetVersion) {
        release = (await axios.get(`${RELEASE_URL}/${targetVersion}$`, options))
          .data
      } else {
        release = (await axios.get(`${RELEASE_URL}/${releaseBranch}`, options))
          .data
      }
    } catch (e) {
      console.error(e)
      sendToOutput(e)
      outputChannel.show()
      this.button.setState(ButtonState.Start)

      if (this.rojoPath && fs.existsSync(this.rojoPath)) {
        vscode.window.showWarningMessage(
          "Unable to check for latest version, falling back to installed version."
        )
        return true
      } else {
        vscode.window.showErrorMessage(
          "Unable to check for latest version and no previous version is installed. Please try again later."
        )
        return false
      }
    }

    if (release == null) {
      this.button.setState(ButtonState.Start)
      vscode.window.showErrorMessage(
        `Rojo: No releases are available for the selected release branch (${releaseBranch})`
      )
      return false
    }

    // Save the current timestamp as the last time we fetched.
    this.context.globalState.update("rojoFetched", Date.now())
    const version = release.tag_name

    // Get an array of all of the assets included with the latest release, and
    const assets: GithubAsset[] = release.assets
    let installedBinary = false
    const versionChanged =
      version !== this.context.globalState.get("rojoVersion")

    // Update the saved version text to reflect what version we have now.
    this.context.globalState.update("rojoVersion", version)

    // TODO: ensure the download finishes before setting this.
    this.setVersion(version)
    // Check if the version we have now is still current. If it is, no need to download again.
    if (fs.existsSync(this.rojoPath) === false) {
      // Our `rojo.exe` either doesn't exist or is out of date, so we show the user we're downloading.
      this.button.setState(ButtonState.Downloading)

      installedBinary = await this.installGitHubBinary(assets, version)
    }

    // Now handle the plugin business
    let installedPlugin = false
    if (
      (installedBinary || !this.isPluginInstalled() || versionChanged) &&
      getPluginIsManaged()
    ) {
      installedPlugin = await this.installPlugin(assets)
    }

    if (installedBinary) {
      vscode.window
        .showInformationMessage(
          `Successfully installed Rojo ${this.version}`,
          "View Release Notes"
        )
        .then(viewNotes => {
          if (viewNotes) {
            vscode.env.openExternal(vscode.Uri.parse(release.html_url))
          }
        })

      Telemetry.trackEvent(
        TelemetryEvent.InstallationSuccess,
        "After installation",
        this.version
      )
    } else if (installedPlugin) {
      vscode.window.showInformationMessage(
        `Successfully installed Roblox Studio plugin from release ${this.version}`
      )
    }

    // Even though the commands handle setting the button state themselves, we need to set it back to "Start" here in case
    // one of the commands bails out early. We don't want it to say "Downloading..." forever, when the real problem is just
    // that rojo.json doesn't exist so the "Rojo: Start server" command dropped out before setting the button.
    this.button.setState(ButtonState.Start)

    return true
  }
}
