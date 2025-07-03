import * as vscode from "vscode"
import * as path from "path"
import { ProjectFile } from "./findProjectFiles"
import { getProjectPathDisplay, ProjectPathDisplay } from "./configuration"

/**
 * Gets the filename of a project file
 */
function getProjectFilename(projectFile: ProjectFile): string {
  return path.basename(projectFile.path.fsPath)
}

/**
 * Gets the full relative path for a project file, excluding the workspace folder name
 */
function getProjectRelativePath(projectFile: ProjectFile): string {
  const relativePath = vscode.workspace.asRelativePath(projectFile.path)
  // Normalize to forward slashes for consistency across platforms
  const normalizedPath = relativePath.replace(/\\/g, "/")

  // Remove the workspace folder name from the beginning of the path
  // e.g., "a/src/default.project.json" -> "src/default.project.json"
  const pathParts = normalizedPath.split("/")
  if (pathParts.length > 1) {
    return pathParts.slice(1).join("/")
  }

  return normalizedPath
}

/**
 * Gets a set of filenames that have conflicts (appear multiple times)
 */
function getConflictingFilenames(projectFiles: ProjectFile[]): Set<string> {
  const filenames = new Set<string>()
  const duplicates = new Set<string>()

  for (const projectFile of projectFiles) {
    const filename = getProjectFilename(projectFile)
    if (filenames.has(filename)) {
      duplicates.add(filename)
    } else {
      filenames.add(filename)
    }
  }

  return duplicates
}

/**
 * Formats a project file display name according to the specified display mode.
 * @param projectFile The project file to format
 * @param displayMode The display mode to use (optional, will read from config if not provided)
 * @returns The formatted display name
 */
export function formatProjectDisplayName(
  projectFile: ProjectFile,
  displayMode?: ProjectPathDisplay
): string {
  const mode = displayMode ?? getProjectPathDisplay()

  switch (mode) {
    case ProjectPathDisplay.Never: {
      return getProjectFilename(projectFile)
    }
    case ProjectPathDisplay.Always: {
      return getProjectRelativePath(projectFile)
    }
    case ProjectPathDisplay.AsNeeded: {
      // For single project context, behave like "never" since we can't detect conflicts
      return getProjectFilename(projectFile)
    }
    default: {
      return getProjectFilename(projectFile)
    }
  }
}

/**
 * Formats project file display names for multiple projects, considering conflicts for "asNeeded" mode.
 * @param projectFiles Array of project files to format
 * @param displayMode The display mode to use (optional, will read from config if not provided)
 * @returns Map of project file paths to their formatted display names
 */
export function formatProjectDisplayNames(
  projectFiles: ProjectFile[],
  displayMode?: ProjectPathDisplay
): Map<string, string> {
  const mode = displayMode ?? getProjectPathDisplay()
  const result = new Map<string, string>()

  switch (mode) {
    case ProjectPathDisplay.Never: {
      for (const projectFile of projectFiles) {
        result.set(projectFile.path.fsPath, getProjectFilename(projectFile))
      }
      break
    }

    case ProjectPathDisplay.Always: {
      for (const projectFile of projectFiles) {
        result.set(projectFile.path.fsPath, getProjectRelativePath(projectFile))
      }
      break
    }

    case ProjectPathDisplay.AsNeeded: {
      const conflictingFilenames = getConflictingFilenames(projectFiles)
      for (const projectFile of projectFiles) {
        const filename = getProjectFilename(projectFile)
        const displayName = conflictingFilenames.has(filename)
          ? getProjectRelativePath(projectFile)
          : filename
        result.set(projectFile.path.fsPath, displayName)
      }
      break
    }

    default: {
      for (const projectFile of projectFiles) {
        result.set(projectFile.path.fsPath, getProjectFilename(projectFile))
      }
      break
    }
  }

  return result
}
