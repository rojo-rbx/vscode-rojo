import * as vscode from "vscode"

/**
 * Enum for three-state configuration options
 */
export enum ThreeStateOption {
  Never = "never",
  AsNeeded = "asNeeded",
  Always = "always",
}

/**
 * Interface for Rojo extension configuration
 */
export interface RojoConfiguration {
  additionalProjectPaths: string[]
  projectPathDisplay: ThreeStateOption
  showFullPath: ThreeStateOption
}

/**
 * Gets the Rojo extension configuration
 * @returns The current Rojo configuration
 */
function getRojoConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("rojo")
}

/**
 * Gets the additional project paths setting
 * @returns Array of additional project paths to search for .project.json files
 */
export function getAdditionalProjectPaths(): string[] {
  try {
    const config = getRojoConfiguration()
    const paths = config.get<string[]>("additionalProjectPaths")

    // Return the configured paths or default to empty array
    return Array.isArray(paths) ? paths : []
  } catch (error) {
    console.error(
      "Failed to get additional project paths configuration:",
      error
    )
    return []
  }
}

/**
 * Gets a three-state configuration setting
 * @param settingName The name of the setting to retrieve
 * @returns The configuration value as ThreeStateOption
 */
export function getConfigSetting(settingName: string): ThreeStateOption {
  try {
    const config = getRojoConfiguration()
    const value = config.get<string>(settingName)

    switch (value) {
      case "never":
        return ThreeStateOption.Never
      case "asNeeded":
        return ThreeStateOption.AsNeeded
      case "always":
        return ThreeStateOption.Always
      default:
        console.warn(
          `Invalid ${settingName} setting: ${value}. Defaulting to 'asNeeded'.`
        )
        return ThreeStateOption.AsNeeded
    }
  } catch (error) {
    console.error(`Failed to get ${settingName} configuration:`, error)
    return ThreeStateOption.AsNeeded
  }
}

/**
 * Gets the full Rojo configuration with proper typing
 * @returns Typed Rojo configuration object
 */
export function getRojoConfig(): RojoConfiguration {
  return {
    additionalProjectPaths: getAdditionalProjectPaths(),
    projectPathDisplay: getConfigSetting("projectPathDisplay"),
    showFullPath: getConfigSetting("showFullPath"),
  }
}
