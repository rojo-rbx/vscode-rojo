import * as vscode from "vscode"

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

  for (const workspaceFolder of folders) {
    const fileNames = (
      await vscode.workspace.fs.readDirectory(workspaceFolder.uri)
    )
      .filter(([, fileType]) => fileType === vscode.FileType.File)
      .map(([fileName]) => fileName)
      .filter((fileName) => fileName.endsWith(".project.json"))

    for (const fileName of fileNames) {
      projectFiles.push({
        name: fileName,
        workspaceFolderName: workspaceFolder.name,
        path: vscode.Uri.joinPath(workspaceFolder.uri, fileName),
      })
    }
  }

  return projectFiles
}
