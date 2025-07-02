import * as vscode from "vscode"

/**
 * Interface for Rojo extension configuration
 */
export interface RojoConfiguration {
  additionalProjectPaths: string[]
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
    console.error("Failed to get additional project paths configuration:", error)
    return []
  }
}

/**
 * Gets the full Rojo configuration with proper typing
 * @returns Typed Rojo configuration object
 */
export function getRojoConfig(): RojoConfiguration {
  return {
    additionalProjectPaths: getAdditionalProjectPaths(),
  }
}