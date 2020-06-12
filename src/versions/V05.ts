import * as childProcess from "child_process"
import fs from "fs-extra"
import path from "path"
import vscode from "vscode"
import { Version, VersionInfo } from "."
import { Rojo } from "../Rojo"
import { getConfiguration } from "../Util"
import { V04Info } from "./V04"

type treeBranch = {
  $path?: string
  $className?: string
  $properties?: { [index: string]: unknown }
  $ignoreUnknownInstances?: boolean
} & { [index: string]: unknown }
export type V05Project = {
  tree?: treeBranch
}

export const V05Info: VersionInfo = {
  name: "v0.5",
  canSyncPointsBeNonServices: true,
  configChangeRestartsRojo: true,
  cliOptions: [],

  getProjectFileName() {
    return "default.project.json"
  },

  getPreviousVersionInfo() {
    return V04Info
  },

  isUpgraderAvailable(folderPath: string) {
    return fs.existsSync(
      path.join(folderPath, this.getPreviousVersionInfo().getProjectFileName())
    )
  }
}

export class V05 implements Version {
  public info = V05Info

  constructor(private rojo: Rojo<V05Project>) {}

  getDefaultProjectFilePath(): string {
    return path.join(this.rojo.getWorkspacePath(), "default.project.json")
  }

  getProjectFilePaths(): string[] {
    return [this.getDefaultProjectFilePath()]
  }

  async build(): Promise<void> {
    const outputConfig = getConfiguration().get("buildOutputPath") as string
    const buildFileFormat = getConfiguration().get("buildFileFormat") as string

    let outputFileType: string
    if (this.isConfigRootDataModel()) {
      outputFileType = buildFileFormat == "XML" ? "rbxlx" : "rbxl"
    } else {
      outputFileType = buildFileFormat == "XML" ? "rbxmx" : "rbxm"
    }

    const outputFile = `${outputConfig}.${outputFileType}`
    const outputPath = path.join(this.rojo.getWorkspacePath(), outputFile)

    await fs.ensureDir(path.dirname(outputPath))

    try {
      this.rojo.sendToOutput(
        childProcess.execFileSync(
          this.rojo.rojoPath,
          ["build", "-o", outputPath],
          {
            cwd: this.rojo.getWorkspacePath()
          }
        ),
        true
      )
    } catch (e) {
      this.rojo.sendToOutput(e.toString(), true)
    }
  }

  isConfigRootDataModel() {
    const config = this.rojo.loadProjectConfig()

    return (
      (config && config.tree && config.tree.$className === "DataModel") || false
    )
  }

  async createSyncPoint(syncPath: string, syncTarget: string) {
    const currentConfig = this.rojo.loadProjectConfig()

    if (!currentConfig || currentConfig.tree === undefined) {
      return false
    }

    const isConfigRootDataModel = this.isConfigRootDataModel()

    const ancestors = syncTarget.split(".")
    let parent = currentConfig.tree

    while (ancestors.length > 0) {
      const name = ancestors.shift()!
      if (!parent[name]) {
        parent[name] = {
          ...(parent === currentConfig.tree && isConfigRootDataModel
            ? {
                $className: name
              }
            : ancestors.length > 0 && {
                $className: "Folder"
              })
        } as treeBranch
      }

      parent = parent[name] as treeBranch
    }

    parent.$path = path
      .relative(path.dirname(this.getDefaultProjectFilePath()), syncPath)
      .replace(/\\/g, "/")

    fs.writeFileSync(
      this.getDefaultProjectFilePath(),
      JSON.stringify(currentConfig, undefined, 2)
    )

    return true
  }

  async upgrade() {
    if (fs.existsSync(this.getDefaultProjectFilePath())) {
      vscode.window.showErrorMessage(
        "default.project.json already exists in this workspace."
      )
      return
    }

    this.rojo.sendToOutput("Converting...", true)

    const output = childProcess.execSync("npx rojo-convert", {
      cwd: this.rojo.getWorkspacePath(),
      encoding: "utf8"
    })

    this.rojo.sendToOutput(output || "Converted")
  }
}
