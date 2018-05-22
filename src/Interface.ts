import * as vscode from 'vscode'
import { getLocalPluginPath, getPluginIsManaged, setPluginIsManaged } from './Util'
import { Bridge } from './Bridge'
import Telemetry, { TelemetryEvent } from './Telemetry'

/**
 * The WebView welcome screen interface.
 * @export
 * @class Interface
 * @extends {vscode.Disposable}
 */
export default class Interface extends vscode.Disposable {
  public panel: vscode.WebviewPanel
  private context: vscode.ExtensionContext
  private getBridge: () => Promise<Bridge>

  constructor (context: vscode.ExtensionContext, getBridge: () => Promise<Bridge>) {
    super(() => this.dispose())

    this.context = context
    this.getBridge = getBridge

    this.panel = vscode.window.createWebviewPanel('rojoWelcome', 'Welcome to Rojo', vscode.ViewColumn.One, {
      enableScripts: true
    })
    this.initialize()
  }

  public dispose (): void {
    this.panel.dispose()
  }

  private async initialize (): Promise<void> {
    // Handle communication from the webview.
    this.panel.webview.onDidReceiveMessage(message => {
      switch (message.type) {
        case 'GET_STATE':
          this.panel.webview.postMessage({ type: 'STATE', state: {
            pluginManagement: getPluginIsManaged(),
            pluginPath: getLocalPluginPath(),
            isFolderOpen: vscode.workspace.workspaceFolders != null
          }})
          break
        case 'SET_MANAGEMENT':
          setPluginIsManaged(message.value)

          Telemetry.trackEvent(TelemetryEvent.PluginManagedChanged, 'WebView', message.value)

          // Reinstall if this changes
          if (message.value) {
            this.getBridge().then(bridge => bridge.reinstall())
          } else {
            this.getBridge().then(bridge => bridge.uninstallPlugin())
          }
          break
        default:
          throw new Error('Invalid IPC message type')
      }
    })

    // Open the HTML and send it to the webview to load.
    const doc = await vscode.workspace.openTextDocument(this.context.asAbsolutePath('src/ui/index.html'))
    // Replace {{root}} with an absolute path to our resources folder.
    this.panel.webview.html = doc.getText().replace(/{{root}}/g, vscode.Uri.file(this.context.asAbsolutePath('./src/ui/')).with({ scheme: 'vscode-resource' }).toString())
  }
}
