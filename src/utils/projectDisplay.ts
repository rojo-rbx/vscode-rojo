import * as vscode from "vscode"
import { ProjectFile } from "../findProjectFiles"

/**
 * Formats a project file display name showing the relative path from workspace root.
 * For files in the root, shows just the filename (e.g., "default.project.json").
 * For files in subdirectories, shows the full relative path (e.g., "src/client/default.project.json").
 * Uses forward slashes for consistency across platforms.
 */
export function formatProjectDisplayName(projectFile: ProjectFile): string {
  const relativePath = vscode.workspace.asRelativePath(projectFile.path)
  
  // Normalize to forward slashes for consistency across platforms
  return relativePath.replace(/\\/g, "/")
}