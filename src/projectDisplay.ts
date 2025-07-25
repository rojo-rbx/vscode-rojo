import * as vscode from "vscode"
import * as path from "path"
import { ProjectFile } from "./findProjectFiles"
import { getConfigSetting, ThreeStateOption } from "./configuration"

/**
 * Interface for project display information
 */
export interface ProjectDisplayInfo {
  displayName: string
  wasTruncated: boolean
  originalName: string
}

/**
 * Checks if a project file is external to the workspace
 * @param projectFile The project file to check
 * @returns true if the project is external to all workspace folders
 */
export function isExternalProject(projectFile: ProjectFile): boolean {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders) {
    return true
  }

  // Check if the project file is within any workspace folder
  for (const folder of workspaceFolders) {
    const relativePath = path.relative(
      folder.uri.fsPath,
      projectFile.path.fsPath
    )
    if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
      return false
    }
  }

  return true
}

/**
 * Gets the filename of a project file
 */
function getProjectFilename(projectFile: ProjectFile): string {
  return path.basename(projectFile.path.fsPath)
}

/**
 * Gets the full relative path for a project file, with appropriate handling for external paths
 */
function getProjectRelativePath(projectFile: ProjectFile): string {
  if (isExternalProject(projectFile)) {
    // For external files, show the full path or a shortened representation
    const fullPath = projectFile.path.fsPath.replace(/\\/g, "/")
    const fileName = path.basename(fullPath)
    const dirName = path.dirname(fullPath)

    // Show parent directory + filename for better context
    const parentDir = path.basename(dirName)
    return `${parentDir}/${fileName}`
  } else {
    // For files within workspace, use relative path excluding workspace folder name
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
 * Groups external projects that would have identical display names using parentDir/filename format
 */
function getExternalProjectConflicts(
  projectFiles: ProjectFile[]
): Map<string, ProjectFile[]> {
  const externalProjects = projectFiles.filter(isExternalProject)
  const displayNameGroups = new Map<string, ProjectFile[]>()

  for (const projectFile of externalProjects) {
    const fullPath = projectFile.path.fsPath.replace(/\\/g, "/")
    const fileName = path.basename(fullPath)
    const dirName = path.dirname(fullPath)
    const parentDir = path.basename(dirName)
    const displayName = `${parentDir}/${fileName}`

    if (!displayNameGroups.has(displayName)) {
      displayNameGroups.set(displayName, [])
    }
    displayNameGroups.get(displayName)!.push(projectFile)
  }

  // Filter to only return groups with conflicts (more than 1 project)
  const conflicts = new Map<string, ProjectFile[]>()
  for (const [displayName, projects] of displayNameGroups) {
    if (projects.length > 1) {
      conflicts.set(displayName, projects)
    }
  }

  return conflicts
}

/**
 * Generates unique display paths for conflicting external projects by walking up directory trees
 */
function getUniqueDisplayPaths(
  conflictingProjects: ProjectFile[]
): Map<string, string> {
  const result = new Map<string, string>()

  if (conflictingProjects.length <= 1) {
    // No conflicts, return regular path
    for (const project of conflictingProjects) {
      result.set(project.path.fsPath, getProjectRelativePath(project))
    }

    return result
  }

  // Split paths into segments for each project
  const pathSegments = conflictingProjects.map((project) => {
    const fullPath = project.path.fsPath.replace(/\\/g, "/")
    const segments = fullPath.split("/").filter((segment) => segment.length > 0)
    return { project, segments }
  })

  // Find the minimum depth needed to make all paths unique
  let depth = 2
  const maxDepth = Math.max(...pathSegments.map((p) => p.segments.length))

  while (depth <= maxDepth) {
    const displayPaths = new Set<string>()
    let allUnique = true

    // Generate display paths at current depth
    const tempResults = new Map<string, string>()
    for (const { project, segments } of pathSegments) {
      const relevantSegments = segments.slice(-depth)
      const displayPath = relevantSegments.join("/")

      if (displayPaths.has(displayPath)) {
        allUnique = false
        break
      }

      displayPaths.add(displayPath)
      tempResults.set(project.path.fsPath, displayPath)
    }

    if (allUnique) {
      // Found unique paths at this depth
      return tempResults
    }

    depth++
  }

  // Use full paths if we couldn't make them unique
  for (const { project, segments } of pathSegments) {
    result.set(project.path.fsPath, segments.join("/"))
  }

  return result
}

/**
 * Formats a project file display name according to the specified display mode.
 * @param projectFile The project file to format
 * @param displayMode The display mode to use (optional, will read from config if not provided)
 * @returns The formatted display name
 */
export function formatProjectDisplayName(
  projectFile: ProjectFile,
  displayMode?: ThreeStateOption
): string {
  const mode = displayMode ?? getConfigSetting("projectPathDisplay")

  switch (mode) {
    case ThreeStateOption.Never: {
      return getProjectFilename(projectFile)
    }
    case ThreeStateOption.Always: {
      return getProjectRelativePath(projectFile)
    }
    case ThreeStateOption.AsNeeded: {
      // For single project context, behave like "never" since we can't detect conflicts
      return getProjectFilename(projectFile)
    }
    default: {
      return getProjectFilename(projectFile)
    }
  }
}

/**
 * Formats project file display names for multiple projects, with truncation and conflict resolution.
 * @param projectFiles Array of project files to format
 * @param displayMode The display mode to use (optional, will read from config if not provided)
 * @param maxLength Maximum length before truncation (default 70)
 * @returns Map of project file paths to their formatted display information
 */
export function formatProjectDisplayNames(
  projectFiles: ProjectFile[],
  displayMode?: ThreeStateOption,
  maxLength: number = 70
): Map<string, ProjectDisplayInfo> {
  const mode = displayMode ?? getConfigSetting("projectPathDisplay")
  const projectDisplayMap = new Map<string, string>()

  switch (mode) {
    case ThreeStateOption.Never: {
      for (const projectFile of projectFiles) {
        projectDisplayMap.set(
          projectFile.path.fsPath,
          getProjectFilename(projectFile)
        )
      }
      break
    }

    case ThreeStateOption.Always: {
      for (const projectFile of projectFiles) {
        projectDisplayMap.set(
          projectFile.path.fsPath,
          getProjectRelativePath(projectFile)
        )
      }
      break
    }

    case ThreeStateOption.AsNeeded: {
      const conflictingFilenames = getConflictingFilenames(projectFiles)
      const externalConflicts = getExternalProjectConflicts(projectFiles)
      const conflictingExternalPaths = new Set<string>()

      // Resolve external project conflicts with unique paths
      for (const [, conflictingProjects] of externalConflicts) {
        const uniquePaths = getUniqueDisplayPaths(conflictingProjects)
        for (const [projectPath, displayPath] of uniquePaths) {
          projectDisplayMap.set(projectPath, displayPath)
          conflictingExternalPaths.add(projectPath)
        }
      }

      // Handle remaining projects (workspace projects + non-conflicting external projects)
      for (const projectFile of projectFiles) {
        if (conflictingExternalPaths.has(projectFile.path.fsPath)) {
          // Already handled by external conflict resolution
          continue
        }

        const filename = getProjectFilename(projectFile)
        const displayName =
          conflictingFilenames.has(filename) || isExternalProject(projectFile)
            ? getProjectRelativePath(projectFile)
            : filename
        projectDisplayMap.set(projectFile.path.fsPath, displayName)
      }
      break
    }

    default: {
      for (const projectFile of projectFiles) {
        projectDisplayMap.set(
          projectFile.path.fsPath,
          getProjectFilename(projectFile)
        )
      }
      break
    }
  }

  // Apply truncation to all results
  const result = new Map<string, ProjectDisplayInfo>()
  for (const [path, displayName] of projectDisplayMap) {
    const truncationInfo = truncateDisplayName(displayName, maxLength)
    result.set(path, {
      displayName: truncationInfo.name,
      wasTruncated: truncationInfo.wasTruncated,
      originalName: truncationInfo.originalName,
    })
  }

  return result
}

/**
 * Truncates a display name if it exceeds the specified length, using smart left-side truncation
 */
function truncateDisplayName(
  displayName: string,
  maxLength: number = 70
): { name: string; wasTruncated: boolean; originalName: string } {
  if (displayName.length <= maxLength) {
    return { name: displayName, wasTruncated: false, originalName: displayName }
  }

  const segments = displayName.split("/")
  const filename = segments[segments.length - 1]

  // If just the filename is too long, truncate it directly
  if (filename.length > maxLength - 3) {
    return {
      name: filename.substring(0, maxLength - 3) + "...",
      wasTruncated: true,
      originalName: displayName,
    }
  }

  // Use left-side truncation: keep filename and folder context, remove from left
  // Reserve space for "..." prefix
  const ellipsisLength = 3
  const availableLength = maxLength - ellipsisLength

  let result = filename
  let usedLength = filename.length

  // Add folder segments from right to left while they fit completely
  for (let i = segments.length - 2; i >= 0; i--) {
    const segment = segments[i]
    const segmentWithSlash = segment + "/"

    if (usedLength + segmentWithSlash.length <= availableLength) {
      result = segmentWithSlash + result
      usedLength += segmentWithSlash.length
    } else {
      result = "..." + result
      return { name: result, wasTruncated: true, originalName: displayName }
    }
  }

  return { name: result, wasTruncated: false, originalName: displayName }
}

/**
 * Gets the appropriate description for a project file (workspace name or "external")
 * @param projectFile The project file
 * @returns The description string
 */
export function getWorkspaceFolderName(projectFile: ProjectFile): string {
  return isExternalProject(projectFile)
    ? "external"
    : projectFile.workspaceFolderName
}
