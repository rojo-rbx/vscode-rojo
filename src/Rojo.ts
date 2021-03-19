import * as childProcess from "child_process"
import * as fs from "fs-extra"
import * as path from "path"
import * as vscode from "vscode"
import { Bridge } from "./Bridge"
import { statusButton } from './extension'
import { ButtonState } from './StatusButton'
import { callWithCounter, isInterfaceOpened } from "./Util"
import { getBridge } from './util/getBridge'
import { getAppropriateVersion } from "./versions"

const PICK_DIFFERENT = "Use another project file"

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
      this.updateRunningButton()
    }
  }

  public static async updateRunningButton() {
    if (!this.isAnyRunning()) return

    const bridge = await getBridge()
    if (!bridge) return

    const projects = []

    for (const rojo of this.stack) {
        let projectName = rojo.getTruncatedProjectFileName()


        if ((vscode.workspace.workspaceFolders?.length ?? 0) > 1) {
          projectName = `${path.basename(rojo.getWorkspacePath())}/${projectName}`
        }

        projects.push(projectName)
    }

    // Add the saved Rojo version to the button while setting it to Running.
    statusButton.setState(
      ButtonState.Running,
      bridge.version,
      projects.join(", ")
    )
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
   * @param {string} projectFileName A relative path to the project file.
   * @param {string} rojoPath The path to the rojo binary.
   * @memberof Rojo
   */
  constructor(
    public workspace: vscode.WorkspaceFolder,
    private projectFileName: string,
    private bridge: Bridge
  ) {
    super(() => this.dispose())

    this.outputChannel = vscode.window.createOutputChannel(
      `Rojo: ${workspace.name}`
    )

    this.rojoPath = bridge.rojoPath

    console.log(`Rojo path: ${this.rojoPath}`)
  }

  public getWorkspacePath() {
    return this.workspace.uri.fsPath
  }

  public getProjectFileName() {
    return this.projectFileName
  }

  public getTruncatedProjectFileName() {
    return this.projectFileName.replace(".project.json", "")
  }

  public setProjectFileName(path: string) {
    this.projectFileName = path
    return this
  }

  /**
   * A wrapper for "rojo init".
   * @memberof Rojo
   */
  public init(): void {
    childProcess.execFileSync(
      this.rojoPath,
      ["init", ...this.version.info.cliOptions],
      {
        cwd: this.getWorkspacePath()
      }
    )

    this.openConfiguration()
  }

  /**
   * A wrapper for "rojo build".
   * @memberof Rojo
   */
  public async build(): Promise<void> {
    return this.version.build(this.projectFileName)
  }

  public async attemptUpgrade() {
    if (!this.version.info.isUpgraderAvailable(this.getWorkspacePath())) {
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
      this.version.info.canSyncPointsBeNonServices &&
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

    this.server = childProcess.spawn(
      this.rojoPath,
      ["serve", this.projectFileName, ...this.version.info.cliOptions],
      {
        cwd: this.getWorkspacePath()
      }
    )

    this.server.stdout.on(
      "data",
      callWithCounter((count, data) => {
        this.sendToOutput(data)

        if (count === 0) {
          const prependText = `[${this.getTruncatedProjectFileName()}] `
          const stringData = data.toString()
          const link = stringData.match(/(https?:\/\/[^\s]*\b)/)

          vscode.window
            .showInformationMessage(
              prependText + stringData,
              PICK_DIFFERENT,
              ...(link ? ["Visit in Browser"] : [])
            )
            .then(buttonClicked => {
              if (buttonClicked === PICK_DIFFERENT) {
                vscode.commands.executeCommand("rojo.start")
              } else if (link && buttonClicked)
                vscode.env.openExternal(vscode.Uri.parse(link[1]))
            })
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

    if (this.version.info.configChangeRestartsRojo) {
      // Start watching for project file changes.
      this.watch()
    }
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
      fs.readFileSync(
        path.join(this.workspace.uri.fsPath, this.projectFileName),
        "utf8"
      )
    )
  }

  /**
   * Opens the current rojo.json file in the editor.
   * @memberof Rojo
   */
  public openConfiguration(): void {
    // Open in column #2 if the interface is open so we don't make people lose progress on the guide
    vscode.workspace
      .openTextDocument(path.join(this.getWorkspacePath(), this.getProjectFileName()))
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
    const projectFilePath = path.join(this.getWorkspacePath(), this.getProjectFileName())

    this.watcher = fs.watch(projectFilePath, () => {
      this.stop()
      this.outputChannel.appendLine(
        "Project configuration changed, reloading Rojo."
      )
      this.serve()
    })
  }
}
