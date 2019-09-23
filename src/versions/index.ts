import { Rojo } from "../Rojo"
import { V04, V04Partial } from "./V04"
import { V05, V05Partial } from "./V05"

export interface Version {
  getDefaultProjectFilePath(): string
  getProjectFilePaths(): string[]
  getProjectFileName(): string

  canSyncPointsBeNonServices: boolean
  createSyncPoint(path: string, target: string): Promise<boolean>

  build(): Promise<void>

  isConfigRootDataModel(): boolean

  isUpgraderAvailable(folderPath: string): boolean
  upgrade(): Promise<void>

  getPreviousVersionPartial(): Partial<Version>
}

const versions = {
  "v0.4": [V04Partial, V04],
  "v0.5": [V05Partial, V05]
} as const

function getVersion(versionString: string) {
  const version = Object.entries(versions).find(([ver]) =>
    versionString.startsWith(ver)
  )

  if (!version) {
    throw new Error("This version of Rojo is unsupported.")
  }

  return version
}

export function getAppropriatePartialVersion(versionString: string) {
  const [, [partial]] = getVersion(versionString)

  return new partial()
}

export function getAppropriateVersion(
  versionString: string,
  rojo: Rojo<any> // eslint-disable-line @typescript-eslint/no-explicit-any
): Version {
  const [, [, full]] = getVersion(versionString)

  return new full(rojo)
}
