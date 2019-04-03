import * as childProcess from 'child_process'
import * as vscode from 'vscode'
import * as fs from 'fs-extra'
import * as path from 'path'
import { isInterfaceOpened, getConfiguration } from './Util'
import { Bridge } from './Bridge'

type treeBranch = { [index: string]: treeBranch | string }

/**
 * Windows-specific Rojo instance. Handles interfacing with the binary.
 * @export
 * @class Rojo
 */
export class Rojo extends vscode.Disposable {
  public workspacePath: string
  private rojoPath: string
  private server?: childProcess.ChildProcess
  private watcher?: fs.FSWatcher
  private configPath: string
  private outputChannel: vscode.OutputChannel

  /**
   * Creates an instance of RojoWin32.
   * @param {vscode.WorkspaceFolder} workspace The workspace folder for which this Rojo instance belongs.
   * @param {string} rojoPath The path to the rojo binary.
   * @memberof Rojo
   */
  constructor (workspace: vscode.WorkspaceFolder, private bridge: Bridge) {
    super(() => this.dispose())

    this.workspacePath = workspace.uri.fsPath
    this.configPath = path.join(this.workspacePath, bridge.getConfigFileName())
    this.outputChannel = vscode.window.createOutputChannel(`Rojo: ${workspace.name}`)

    this.rojoPath = bridge.rojoPath
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
   * A wrapper for "rojo build".
   * @memberof Rojo
   */
  public async build (): Promise<void> {
    if (!this.bridge.isEpiphany()) {
      vscode.window.showErrorMessage('Rojo Build is only supported on 0.5.x or newer.')
      return
    }

    const outputConfig = getConfiguration().get('buildOutputPath') as string
    const outputFile = `${outputConfig}.${this.isConfigRootDataModel() ? 'rbxl' : 'rbxm'}`
    const outputPath = path.join(this.workspacePath, outputFile)

    await fs.ensureDir(path.dirname(outputPath))

    try {
      this.sendToOutput(
        childProcess.execFileSync(this.rojoPath, ['build', '-o', outputPath], {
          cwd: this.workspacePath
        }),
        true
      )
    } catch(e) {
      this.sendToOutput(e.toString(), true)
    }

  }

  private sendToOutput (data: string | Buffer, show?: boolean) {
    this.outputChannel.append(data.toString())

    if (show) {
      this.outputChannel.show()
    }
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

    this.server.stdout.on('data', this.sendToOutput)
    this.server.stderr.on('data', this.sendToOutput)

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

  public loadProjectConfig<T extends object> () {
    const currentConfigString = fs.readFileSync(this.configPath, 'utf8')
    let currentConfig: T

    try {
      currentConfig = JSON.parse(currentConfigString)
    } catch (e) {
      return false
    }

    return currentConfig
  }

  public createPartitionRojo04 (partitionPath: string, partitionTarget: string): boolean {
    const currentConfig = this.loadProjectConfig<{partitions: {[index: string]: {path: string, target: string}}}>()

    if (!currentConfig) {
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

  private isConfigRootDataModel (): boolean {
    if (!this.bridge.isEpiphany()) {
      throw new Error('Attempt to check if root is DataModel on 0.4.x')
    }

    const config = this.loadProjectConfigEpiphany()

    return config && config.tree && config.tree.$className === 'DataModel' || false
  }

  private loadProjectConfigEpiphany () {
    return this.loadProjectConfig<{
      tree?: treeBranch
    }>()
  }

  /**
   * Creates a partition in the rojo.json file.
   * @param {string} partitionPath The partition path
   * @param {string} partitionTarget The partition target
   * @returns {boolean} Successful?
   * @memberof Rojo
   */
  public createPartitionEpiphany (partitionPath: string, partitionTarget: string): boolean {
    const currentConfig = this.loadProjectConfigEpiphany()
    if (!currentConfig || currentConfig.tree === undefined) {
      return false
    }

    // TODO: Lift this restriction. Need to update the picker too.
    if (this.isConfigRootDataModel()) {
      vscode.window.showErrorMessage('Cannot automatically create partitions when tree root is not DataModel')
      return false
    }

    const ancestors = partitionTarget.split('.')
    let parent = currentConfig.tree

    while (ancestors.length > 0) {
      const name = ancestors.shift()!
      if (!parent[name]) {
        parent[name] = {
          ...parent === currentConfig.tree && {
            $className: name
          }
        } as treeBranch
      }

      parent = parent[name] as treeBranch
    }

    parent.$path = path.relative(path.dirname(this.configPath), partitionPath).replace(/\\/g, '/')

    fs.writeFileSync(this.configPath, JSON.stringify(currentConfig, undefined, 2))

    return true
  }

  public createPartition (partitionPath: string, partitionTarget: string): boolean {
    if (this.bridge.isEpiphany()) {
      return this.createPartitionEpiphany(partitionPath, partitionTarget)
    } else {
      return this.createPartitionRojo04(partitionPath, partitionTarget)
    }
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
