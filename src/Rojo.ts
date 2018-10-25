import * as childProcess from 'child_process'
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { isInterfaceOpened } from './Util'

/**
 * Windows-specific Rojo instance. Handles interfacing with the binary.
 * @export
 * @class Rojo
 */
export class Rojo extends vscode.Disposable {
  private rojoPath: string
  private server?: childProcess.ChildProcess
  private watcher?: fs.FSWatcher
  private workspacePath: string
  private configPath: string
  private outputChannel: vscode.OutputChannel

  /**
   * Creates an instance of RojoWin32.
   * @param {vscode.WorkspaceFolder} workspace The workspace folder for which this Rojo instance belongs.
   * @param {string} rojoPath The path to the rojo binary.
   * @memberof Rojo
   */
  constructor (workspace: vscode.WorkspaceFolder, rojoPath: string) {
    super(() => this.dispose())

    this.workspacePath = workspace.uri.fsPath
    this.configPath = path.join(this.workspacePath, 'rojo.json')
    this.outputChannel = vscode.window.createOutputChannel(`Rojo: ${workspace.name}`)

    this.rojoPath = rojoPath
  }

  /**
   * Determines if this instance is currently serving with "rojo serve.
   * @readonly
   * @type {boolean}
   * @memberof Rojo
   */
  public get serving (): boolean {
    return !!this.server
  }

  /**
   * A wrapper for "rojo init".
   * @memberof Rojo
   */
  public init (): void {
    childProcess.execFileSync(this.rojoPath, ['init'], {
      cwd: this.workspacePath
    })

    this.openConfiguration()
  }

  /**
   * A wrapper for "rojo serve".
   * Also adds a watcher to "rojo.json" and reloads the server if it changes.
   * @memberof Rojo
   */
  public serve (): void {
    if (this.server) {
      this.stop()
    }

    this.server = childProcess.spawn(this.rojoPath, ['serve'], {
      cwd: this.workspacePath
    })

    // A helper function so we can send the output from Rojo right on over to the VS Code output.
    const sendToOutput = (data: string | Buffer) => this.outputChannel.append(data.toString())

    this.server.stdout.on('data', sendToOutput)
    this.server.stderr.on('data', sendToOutput)

    // This is what makes the output channel snap open we start serving.
    this.outputChannel.show()

    // Start watching for "rojo.json" changes.
    this.watch()
  }

  /**
   * Stops "rojo serve" if it's currently serving.
   * Also handles closing out the file watcher.
   * @memberof Rojo
   */
  public stop (): void {
    if (!this.server) return

    this.server.kill()
    this.server = undefined

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
  public dispose (): void {
    this.outputChannel.dispose()

    if (this.server) {
      this.stop()
    }
  }

  /**
   * Creates a partition in the rojo.json file.
   * @param {string} partitionPath The partition path
   * @param {string} partitionTarget The partition target
   * @returns {boolean} Successful?
   * @memberof Rojo
   */
  public createPartition (partitionPath: string, partitionTarget: string): boolean {
    const currentConfigString = fs.readFileSync(this.configPath, 'utf8')
    let currentConfig: {partitions: {[index: string]: {path: string, target: string}}}

    try {
      currentConfig = JSON.parse(currentConfigString)
    } catch (e) {
      return false
    }

    let newName = path.basename(partitionPath, '.lua')

    while (currentConfig.partitions[newName] != null) {
      const numberPattern = / \((\d+)\)/
      const numberMatch = newName.match(numberPattern)
      if (numberMatch) {
        newName = newName.replace(numberPattern, ` (${(parseInt(numberMatch[1], 10) + 1).toString()})`)
      } else {
        newName += ' (2)'
      }
    }

    currentConfig.partitions[newName] = {
      path: path.relative(path.dirname(this.configPath), partitionPath).replace(/\\/g, '/'),
      target: partitionTarget
    }

    fs.writeFileSync(this.configPath, JSON.stringify(currentConfig, undefined, 2))

    return true
  }

  /**
   * Called internally by "serve". Handles setting up the file watcher for "rojo.json".
   * @private
   * @memberof Rojo
   */
  private watch (): void {
    this.watcher = fs.watch(this.configPath, () => {
      this.stop()
      this.outputChannel.appendLine('rojo.json changed, reloading Rojo.')
      this.serve()
    })
  }

  /**
   * Opens the current rojo.json file in the editor.
   * @memberof Rojo
   */
  public openConfiguration (): void {
    // Open in column #2 if the interface is open so we don't make people lose progress on the guide
    vscode.workspace.openTextDocument(this.configPath).then(doc => vscode.window.showTextDocument(doc, isInterfaceOpened() ? vscode.ViewColumn.Two : undefined))
  }
}
