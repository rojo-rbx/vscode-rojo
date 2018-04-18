import * as childProcess from 'child_process'
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

export abstract class Rojo {
  protected workspace: vscode.WorkspaceFolder
  protected workspacePath: string
  protected configPath: string
  protected outputChannel: vscode.OutputChannel

  constructor (workspace: vscode.WorkspaceFolder) {
    this.workspace = workspace
    this.workspacePath = workspace.uri.fsPath
    this.configPath = path.join(this.workspacePath, 'rojo.json')
    this.outputChannel = vscode.window.createOutputChannel(`Rojo: ${workspace.name}`)
  }

  public abstract get serving (): boolean
  public abstract init (): void
  public abstract serve (): void
  public abstract stop (): void
  public abstract dispose (): void
}

export class RojoWin32 extends Rojo {
  private rojoPath: string
  private server?: childProcess.ChildProcess
  private watcher?: fs.FSWatcher

  constructor (workspace: vscode.WorkspaceFolder, rojoPath: string) {
    super(workspace)

    this.rojoPath = rojoPath
  }

  public get serving (): boolean {
    return !!this.server
  }

  public init (): void {
    childProcess.execFileSync(this.rojoPath, ['init'], {
      cwd: this.workspacePath
    })

    vscode.workspace.openTextDocument(this.configPath).then(doc => vscode.window.showTextDocument(doc))
  }

  public serve (): void {
    if (this.server) {
      this.server.kill()
    }

    this.server = childProcess.spawn(this.rojoPath, ['serve'], {
      cwd: this.workspacePath
    })

    const sendToOutput = (data: string | Buffer) => this.outputChannel.append(data.toString())

    this.server.stdout.on('data', sendToOutput)
    this.server.stderr.on('data', sendToOutput)

    this.outputChannel.show()

    this.watch()
  }

  public stop (): void {
    if (!this.server) return

    this.server.kill()
    this.server = undefined

    if (this.watcher) {
      this.watcher.close()
      this.watcher = undefined
    }
  }

  public dispose (): void {
    this.outputChannel.dispose()

    if (this.server) {
      this.stop()
    }
  }

  private watch (): void {
    this.watcher = fs.watch(this.configPath, () => {
      this.stop()
      this.outputChannel.appendLine('rojo.json changed, reloading Rojo.')
      this.serve()
    })
  }
}
