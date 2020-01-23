import { Rojo } from "../Rojo"
import { V04, V04Info } from "./V04"
import { V05, V05Info } from "./V05"
import { V06, V06Info } from "./V06"

export interface VersionInfo {
  getProjectFileName(): string
  canSyncPointsBeNonServices: boolean
  getPreviousVersionInfo(): VersionInfo
  isUpgraderAvailable(folderPath: string): boolean
  configChangeRestartsRojo: boolean
  name: string
}

export interface Version {
  info: VersionInfo
  getDefaultProjectFilePath(): string
  getProjectFilePaths(): string[]
  createSyncPoint(path: string, target: string): Promise<boolean>
  build(): Promise<void>
  upgrade(): Promise<void>
  isConfigRootDataModel(): boolean
}

const versions = {
  "v0.4": [V04Info, V04],
  "v0.5": [V05Info, V05],
  "v0.6": [V06Info, V06]
} as const

function getVersion(
  versionString: string
): [string, [VersionInfo, new (rojo: Rojo) => Version]] {
  const version = Object.entries(versions).find(([ver]) =>
    versionString.startsWith(ver)
  )

  if (!version) {
    throw new Error("This version of Rojo is unsupported.")
  }

  return (version as unknown) as [
    string,
    [VersionInfo, new (rojo: Rojo) => Version]
  ]
}

export function getAppropriateVersionInfo(versionString: string) {
  const [, [info]] = getVersion(versionString)

  return info
}

export function getAppropriateVersion(
  versionString: string,
  rojo: Rojo<any> // eslint-disable-line @typescript-eslint/no-explicit-any
): Version {
  const [, [, full]] = getVersion(versionString)

  return new full(rojo)
}
