import * as vscode from "vscode"
import * as path from "path"
import { getAdditionalProjectPaths } from "./configuration"

export type ProjectFile = {
  name: string
  workspaceFolderName: string
  path: vscode.Uri
}

export async function findProjectFiles(): Promise<ProjectFile[]> {
  const folders = vscode.workspace.workspaceFolders

  if (!folders) {
    return Promise.reject(
      "You must open VS Code on a workspace folder to do this."
    )
  }

  const projectFiles: ProjectFile[] = []
  const foundPaths = new Set<string>()

  for (const workspaceFolder of folders) {
    await searchForProjectFiles(
      workspaceFolder,
      workspaceFolder.uri,
      projectFiles,
      foundPaths
    )

    const additionalPaths = getAdditionalProjectPaths()
    for (const additionalPath of additionalPaths) {
      const searchUri = path.isAbsolute(additionalPath)
        ? vscode.Uri.file(additionalPath)
        : vscode.Uri.joinPath(workspaceFolder.uri, additionalPath)

      await searchForProjectFiles(
        workspaceFolder,
        searchUri,
        projectFiles,
        foundPaths
      )
    }
  }

  return projectFiles
}

async function searchForProjectFiles(
  workspaceFolder: vscode.WorkspaceFolder,
  searchUri: vscode.Uri,
  projectFiles: ProjectFile[],
  foundPaths: Set<string>
): Promise<void> {
  try {
    const fileNames = (await vscode.workspace.fs.readDirectory(searchUri))
      .filter(([, fileType]) => fileType === vscode.FileType.File)
      .map(([fileName]) => fileName)
      .filter((fileName) => fileName.endsWith(".project.json"))

    for (const fileName of fileNames) {
      const filePath = vscode.Uri.joinPath(searchUri, fileName)
      const pathKey = filePath.toString()

      if (!foundPaths.has(pathKey)) {
        foundPaths.add(pathKey)
        projectFiles.push({
          name: fileName,
          workspaceFolderName: workspaceFolder.name,
          path: filePath,
        })
      }
    }
  } catch (error) {
    console.debug(`Could not search directory ${searchUri.toString()}:`, error)
  }
}
