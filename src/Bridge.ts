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

function promisifyStream (stream: fs.WriteStream) {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve)
    stream.on('error', reject)
  })
}

export class Bridge {
  public ready: boolean = false
  public version: string
  private button: StatusButton
  private context: vscode.ExtensionContext
  private rojoPath: string
  private rojoMap: Map<vscode.WorkspaceFolder, Rojo> = new Map()

  constructor (context: vscode.ExtensionContext, button: StatusButton) {
    this.context = context
    this.button = button
    this.version = this.context.globalState.get('rojoVersion') || 'unknown version'

    const storePath = path.join(this.context.extensionPath, 'bin')
    if (!fs.existsSync(storePath)) {
      fs.mkdirSync(storePath)
    }

    this.rojoPath = path.join(storePath, 'rojo.exe')
  }

  static async new (context: vscode.ExtensionContext, button: StatusButton) {
    const rojoBridge = new Bridge(context, button)
    await rojoBridge.prepare()
    return rojoBridge
  }

  public getRojo (workspace: vscode.WorkspaceFolder): Rojo {
    if (!this.ready) {
      throw new Error('Attempt to get Rojo instance before bridge was ready')
    }

    if (!this.rojoMap.has(workspace)) {
      this.rojoMap.set(workspace, new RojoWin32(workspace, this.rojoPath))
    }

    return this.rojoMap.get(workspace) as Rojo
  }

  public dispose () {
    for (let rojo of this.rojoMap.values()) {
      rojo.dispose()
    }

    this.ready = false
  }

  private async prepare () {
    if (this.doesNeedInstall()) {
      const success = await this.installRojo()
      this.ready = success
    } else {
      this.ready = true
    }
  }

  private doesNeedInstall (): boolean {
    if (os.platform() === 'win32') {
      const lastFetched: number = this.context.globalState.get('rojoFetched') || 0
      return !fs.existsSync(this.rojoPath) || Date.now() - lastFetched > 86400000
    }

    return true
  }

  private async installRojo (): Promise<boolean> {
    if (os.platform() === 'win32') {
      return this.installWin32()
    }

    vscode.window.showErrorMessage('This extension only supports Windows right now.')
    return false
  }

  private async installWin32 (): Promise<boolean > {
    this.button.setState(ButtonState.Updating)

    const response = await axios.get(RELEASE_URL)

    this.context.globalState.update('rojoFetched', Date.now())
    const version = response.data.tag_name

    if (fs.existsSync(this.rojoPath) && version === this.context.globalState.get('rojoVersion')) {
      console.log('Version match, skipping download.')
      return true
    }

    this.button.setState(ButtonState.Downloading)

    this.version = this.version
    this.context.globalState.update('rojoVersion', version)

    const assets: GithubAsset[] = response.data.assets
    const file = assets.find(file => file.name === BINARY_NAME && file.content_type === 'application/x-msdownload')

    if (!file) {
      vscode.window.showErrorMessage("Couldn't fetch latest Rojo: can't find a binary in the latest release.")
      return false
    }

    const download = await axios.get(file.browser_download_url, {
      responseType: 'stream'
    })

    const writeStream = fs.createWriteStream(this.rojoPath)
    download.data.pipe(writeStream)

    try {
      await promisifyStream(download.data)
      writeStream.close()
    } catch (e) {
      console.log(e)
      vscode.window.showErrorMessage("Couldn't fetch latest Rojo: an error occurred while downloading the latest binary.")
      this.button.setState(ButtonState.Hidden)
      return false
    }

    this.button.setState(ButtonState.Start)

    return true
  }
}

export default function BridgeFactory (context: vscode.ExtensionContext, button: StatusButton) {
  let currentBridge: Promise<Bridge>

  return () => {
    if (currentBridge) return currentBridge

    currentBridge = Bridge.new(context, button)
    return currentBridge
  }
}
