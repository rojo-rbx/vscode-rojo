import * as vscode from "vscode"

/**
 * Enum for project path display modes
 */
export enum ProjectPathDisplay {
  Never = "never",
  AsNeeded = "asNeeded",
  Always = "always",
}

/**
 * Interface for Rojo extension configuration
 */
export interface RojoConfiguration {
  additionalProjectPaths: string[]
  projectPathDisplay: ProjectPathDisplay
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
 * Gets the project path display setting
 * @returns The project path display mode
 */
export function getProjectPathDisplay(): ProjectPathDisplay {
  try {
    const config = getRojoConfiguration()
    const display = config.get<string>("projectPathDisplay")

    switch (display) {
      case "never":
        return ProjectPathDisplay.Never
      case "asNeeded":
        return ProjectPathDisplay.AsNeeded
      case "always":
        return ProjectPathDisplay.Always
      default:
        console.warn(
          `Invalid projectPathDisplay setting: ${display}. Defaulting to 'asNeeded'.`
        )
        return ProjectPathDisplay.AsNeeded
    }
  } catch (error) {
    console.error("Failed to get project path display configuration:", error)
    return ProjectPathDisplay.AsNeeded
  }
}

/**
 * Gets the full Rojo configuration with proper typing
 * @returns Typed Rojo configuration object
 */
export function getRojoConfig(): RojoConfiguration {
  return {
    additionalProjectPaths: getAdditionalProjectPaths(),
    projectPathDisplay: getProjectPathDisplay(),
  }
}
