import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as vscode from 'vscode'
import axios from 'axios'
import { Rojo, RojoWin32 } from './Rojo'
import StatusButton, { ButtonState } from './StatusButton'

const RELEASE_URL = 'https://api.github.com/repos/LPGhatguy/rojo/releases/latest'
const BINARY_NAME = 'rojo.exe'

interface GithubAsset {
  name: string,
  content_type: string,
  browser_download_url: string
}

/**
 * A utility function that takes a stream and converts it into a promise.
 * Resolves on stream end, or rejects on stream error.
 * @param {fs.WriteStream} stream The stream to promisify
 * @returns {Promise<any>} A promise that resolves or rejects based on the status of the stream.
 */
function promisifyStream (stream: fs.WriteStream): Promise<any> {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve)
    stream.on('error', reject)
  })
}

/**
 * A bridge between our extension and Rojo, which handles installing, preparing, and giving access to Rojo.
 * @export
 * @class Bridge
 */
export class Bridge {
  public ready: boolean = false
  public version: string
  private button: StatusButton
  private context: vscode.ExtensionContext
  private rojoPath: string
  private rojoMap: Map<vscode.WorkspaceFolder, Rojo> = new Map()

  constructor (context: vscode.ExtensionContext, button: StatusButton) {
    // Store the extension context and status button for use later.
    this.context = context
    this.button = button
    // Attempt to load the version from our extension settings. This way, the version number is preserved across Code restarts.
    // Sets to "unknown version" if we've never downloaded Rojo before, but this gets re-set correctly in the installation methods.
    this.version = this.context.globalState.get('rojoVersion') || 'unknown version'

    // Some windows-specific settings for Rojo binaries, may need to refactor this later.
    const storePath = path.join(this.context.extensionPath, 'bin')
    if (!fs.existsSync(storePath)) {
      fs.mkdirSync(storePath)
    }

    this.rojoPath = path.join(storePath, 'rojo.exe')
  }

  /**
   * A static asyncrhonous bootstrapper for this class to allow instantiation to be `await`ed.
   * Calls and waits for the `prepare` method before returning the class.
   * @static
   * @param {vscode.ExtensionContext} context The extension context from the `activate` function.
   * @param {StatusButton} button An instance of our StatusButotn class
   * @returns {Promise<Bridge>} A new Bridge which has been prepared.
   * @memberof Bridge
   */
  static async new (context: vscode.ExtensionContext, button: StatusButton): Promise<Bridge> {
    const rojoBridge = new Bridge(context, button)
    await rojoBridge.prepare()
    return rojoBridge
  }

  /**
   * Gets or creates the proper Rojo instance for the given workspace folder.
   * Only usable when the bridge is ready.
   * @param {vscode.WorkspaceFolder} workspace The workspace for which to get the Rojo instance.
   * @returns {Rojo} The Rojo instance for the given workspace.
   * @memberof Bridge
   */
  public getRojo (workspace: vscode.WorkspaceFolder): Rojo {
    if (!this.ready) {
      throw new Error('Attempt to get Rojo instance before bridge was ready')
    }

    if (!this.rojoMap.has(workspace)) {
      // TODO: determine the proper platform here and instantiate that.
      this.rojoMap.set(workspace, new RojoWin32(workspace, this.rojoPath))
    }

    return this.rojoMap.get(workspace) as Rojo
  }

  /**
   * A method to safely dispose of all Rojo instances.
   * Called when the extension deactivates.
   * @memberof Bridge
   */
  public dispose (): void {
    for (let rojo of this.rojoMap.values()) {
      rojo.dispose()
    }

    this.ready = false
  }

  /**
   * A method called internally by the static `new` method that handles preparing the bridge for use,
   * including installation.
   * @private
   * @returns {Promise<void>} Resolves when the bridge has been prepared
   * @memberof Bridge
   */
  private async prepare (): Promise<void> {
    if (this.doesNeedInstall()) {
      this.ready = await this.installRojo()
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
  private doesNeedInstall (): boolean {
    if (os.platform() === 'win32') {
      const lastFetched: number = this.context.globalState.get('rojoFetched') || 0
      return !fs.existsSync(this.rojoPath) || Date.now() - lastFetched > 3600000
    }

    return true
  }

  /**
   * Determines the correct platform and then dispatches the installer for that platform.
   * @private
   * @returns {boolean} Whether or not installation was successful.
   * @memberof Bridge
   */
  private async installRojo (): Promise<boolean> {
    if (os.platform() === 'win32') {
      return this.installWin32()
    }

    vscode.window.showErrorMessage('This extension only supports Windows right now.')
    return false
  }

  /**
   * Rojo installer for Windows platforms.
   * @private
   * @returns {boolean} Whether or not installation was successful.
   * @memberof Bridge
   */
  private async installWin32 (): Promise<boolean > {
    // Update our user-facing button to indicate we're checking for an update.
    this.button.setState(ButtonState.Updating)

    // Fetch the latest release from Rojo's releases page.
    const response = await axios.get(RELEASE_URL)

    // Save the current timestamp as the last time we fetched.
    this.context.globalState.update('rojoFetched', Date.now())
    const version = response.data.tag_name

    // Check if the version we have now is still current. If it is, no need to download again.
    if (fs.existsSync(this.rojoPath) && version === this.context.globalState.get('rojoVersion')) {
      console.log('Version match, skipping download.')
      this.button.setState(ButtonState.Start)
      return true
    }

    // Our `rojo.exe` either doesn't exist or is out of date, so we show the user we're downloading.
    this.button.setState(ButtonState.Downloading)

    // Update the saved version text to reflect what version we have now.
    // TODO: ensure the download finishes before setting this.
    this.version = version
    this.context.globalState.update('rojoVersion', version)

    // Get an array of all of the assets included with the latest release, and look for one that matches `rojo.exe`.
    const assets: GithubAsset[] = response.data.assets
    const file = assets.find(file => file.name === BINARY_NAME && file.content_type === 'application/x-msdownload')

    // If no matching file is found, just give up for now.
    // TODO: Add better stability to this area so it can fallback to older known working binaries.
    if (!file) {
      vscode.window.showErrorMessage("Couldn't fetch latest Rojo: can't find a binary in the latest release.")
      return false
    }

    // Start the download of the binary as a stream
    const download = await axios.get(file.browser_download_url, {
      responseType: 'stream'
    })

    const writeStream = fs.createWriteStream(this.rojoPath)
    download.data.pipe(writeStream)

    // Wrap in a try/catch because lots of things can go wrong when downloading files.
    try {
      // Wait for the download to complete (or fail)
      await promisifyStream(download.data)

      // Important to close the stream since we're spawning the binary with child_process immediately afterwards.
      // If we don't close the stream, the file will still be marked as busy.
      writeStream.close()
    } catch (e) {
      console.log(e)
      vscode.window.showErrorMessage("Couldn't fetch latest Rojo: an error occurred while downloading the latest binary.")
      this.button.setState(ButtonState.Hidden)
      return false
    }

    // Even though the commands handle setting the button state themselves, we need to set it back to "Start" here in case
    // one of the commands bails out early. We don't want it to say "Downloading..." forever, when the real problem is just
    // that rojo.json doesn't exist so the "Rojo: Start server" command dropped out before setting the button.
    this.button.setState(ButtonState.Start)

    return true
  }
}

/**
 * A function that returns a factory function that will always resolve to the same bridge instance.
 * We don't want any race conditions, so this is important to ensure that the same bridge is used
 * every time. Handles giving out the promise resolving to our bridge instance so that even if it's
 * called multiple times before the bridge is ready, the promises will all resolve at the same time.
 * @export
 * @param {vscode.ExtensionContext} context
 * @param {StatusButton} button
 * @returns
 */
export default function BridgeFactory (context: vscode.ExtensionContext, button: StatusButton): () => Promise<Bridge> {
  // We want the raw promise here to eliminate race conditions. We don't want to accidentally create more than one bridge.
  let currentBridge: Promise<Bridge>

  return () => {
    if (currentBridge) return currentBridge

    currentBridge = Bridge.new(context, button)
    return currentBridge
  }
}
