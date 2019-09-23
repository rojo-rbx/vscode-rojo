import * as childProcess from "child_process"
import * as fs from "fs-extra"
import * as vscode from "vscode"
import { Bridge } from "./Bridge"
import { callWithCounter, isInterfaceOpened } from "./Util"
import { getAppropriateVersion } from "./versions"

/**
 * Windows-specific Rojo instance. Handles interfacing with the binary.
 * @export
 * @class Rojo
 */
export class Rojo<C extends object = {}> extends vscode.Disposable {
  /**
   * Determines if this instance is currently serving with "rojo serve.
   * @readonly
   * @type {boolean}
   * @memberof Rojo
   */
  public get serving(): boolean {
    return !!this.server
  }

  public static stopLast() {
    if (this.isAnyRunning()) {
      this.stack.pop()!.stop()
    }
  }

  public static stopAll() {
    this.stack.forEach(rojo => rojo.stop())
  }

  public static isAnyRunning() {
    return this.stack.length > 0
  }
  private static stack: Rojo[] = []
  public readonly rojoPath: string
  private server?: childProcess.ChildProcess
  private watcher?: fs.FSWatcher
  private outputChannel: vscode.OutputChannel
  private version = getAppropriateVersion(this.bridge.getVersionString(), this)

  /**
   * Creates an instance of RojoWin32.
   * @param {vscode.WorkspaceFolder} workspace The workspace folder for which this Rojo instance belongs.
   * @param {string} rojoPath The path to the rojo binary.
   * @memberof Rojo
   */
  constructor(
    public workspace: vscode.WorkspaceFolder,
    private bridge: Bridge
  ) {
    super(() => this.dispose())

    this.outputChannel = vscode.window.createOutputChannel(
      `Rojo: ${workspace.name}`
    )

    this.rojoPath = bridge.rojoPath
  }

  public getWorkspacePath() {
    return this.workspace.uri.fsPath
  }

  /**
   * A wrapper for "rojo init".
   * @memberof Rojo
   */
  public init(): void {
    childProcess.execFileSync(this.rojoPath, ["init"], {
      cwd: this.getWorkspacePath()
    })

    this.openConfiguration()
  }

  /**
   * A wrapper for "rojo build".
   * @memberof Rojo
   */
  public async build(): Promise<void> {
    return this.version.build()
  }

  public async attemptUpgrade() {
    if (!this.version.isUpgraderAvailable(this.getWorkspacePath())) {
      vscode.window.showInformationMessage(
        "No upgrader is available for this version."
      )
    }
    return this.version.upgrade()
  }

  public sendToOutput(data: string | Buffer, show?: boolean) {
    this.outputChannel.append(data.toString())

    if (show) {
      this.outputChannel.show()
    }
  }

  public createSyncPoint(syncPath: string, syncTarget: string) {
    return this.version.createSyncPoint(syncPath, syncTarget)
  }

  public shouldSyncPathBeginWithService() {
    return (
      this.version.canSyncPointsBeNonServices &&
      this.version.isConfigRootDataModel()
    )
  }

  /**
   * A wrapper for "rojo serve".
   * Also adds a watcher to "rojo.json" and reloads the server if it changes.
   * @memberof Rojo
   */
  public serve(): void {
    if (this.server) {
      this.stop()
    }

    this.server = childProcess.spawn(this.rojoPath, ["serve"], {
      cwd: this.getWorkspacePath()
    })

    this.server.stdout.on(
      "data",
      callWithCounter((count, data) => {
        this.sendToOutput(data)

        if (count === 0) {
          vscode.window.showInformationMessage(data.toString())
        } else if (count === 1) {
          this.outputChannel.show()
        }
      })
    )

    this.server.stderr.on(
      "data",
      callWithCounter((count, data) => {
        this.sendToOutput(data)

        if (count === 0) {
          this.outputChannel.show()
        }
      })
    )

    Rojo.stack.push(this)

    // Start watching for "rojo.json" changes.
    this.watch()
  }

  /**
   * Stops "rojo serve" if it's currently serving.
   * Also handles closing out the file watcher.
   * @memberof Rojo
   */
  public stop(): void {
    if (!this.server) {
      return
    }

    this.server.kill()
    this.server = undefined

    Rojo.stack = Rojo.stack.filter(r => r !== this)

    if (this.watcher) {
      this.watcher.close()
      this.watcher = undefined
    }
  }

  /**
   * A method to be called when cleaning up this instance.
   * Terminates the file watcher and the server, if it's running.
   * @memberof Rojo
   */
  public dispose(): void {
    this.outputChannel.dispose()

    if (this.server) {
      this.stop()
    }
  }

  public loadProjectConfig(): C {
    return JSON.parse(
      fs.readFileSync(this.version.getDefaultProjectFilePath(), "utf8")
    )
  }

  /**
   * Opens the current rojo.json file in the editor.
   * @memberof Rojo
   */
  public openConfiguration(): void {
    // Open in column #2 if the interface is open so we don't make people lose progress on the guide
    vscode.workspace
      .openTextDocument(this.version.getDefaultProjectFilePath())
      .then(doc =>
        vscode.window.showTextDocument(
          doc,
          isInterfaceOpened() ? vscode.ViewColumn.Two : undefined
        )
      )
  }

  /**
   * Called internally by "serve". Handles setting up the file watcher for project config.
   * @private
   * @memberof Rojo
   */
  private watch(): void {
    this.watcher = fs.watch(this.version.getDefaultProjectFilePath(), () => {
      this.stop()
      this.outputChannel.appendLine(
        "Project configuration changed, reloading Rojo."
      )
      this.serve()
    })
  }
}
