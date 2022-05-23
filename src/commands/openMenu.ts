import * as path from "path"
import * as vscode from "vscode"
import { buildProject } from "../buildProject"
import { createProjectFile } from "../createProjectFile"
import { State } from "../extension"
import { findProjectFiles, ProjectFile } from "../findProjectFiles"
import { getRojoInstall, InstallType } from "../getRojoInstall"
import { installRojo } from "../installRojo"
import { result } from "../result"
import { serveProject } from "../serveProject"

const stopAndServeButton = {
  iconPath: new vscode.ThemeIcon("debug-continue"),
  tooltip: "Stop others and serve this project",
  action: "stopAndServe",
}

const openFileButton = {
  iconPath: new vscode.ThemeIcon("go-to-file"),
  tooltip: "Open project file in editor",
  action: "open",
}

const buildButton = {
  iconPath: new vscode.ThemeIcon("package"),
  tooltip: "Build project",
  action: "build",
}

const rojoNotInstalled = [
  {
    label: "$(rocket) Rojo",
    description: "Not installed",
    detail: "Rojo is not installed in this project\n",
    info: true,
  },
  {
    label: "$(desktop-download) Install Rojo now",
    detail: "Click here to download and install Rojo.",
    action: "install",
  },
]

type PickItem = {
  label: string
  description?: string
  detail?: string | undefined
  action?: string | undefined
  projectFile?: ProjectFile
  buttons?: {
    iconPath: vscode.ThemeIcon
    tooltip: string
  }[]
  info?: boolean
}

function getInstallDetail(
  installType: InstallType | undefined,
  mixed: boolean
) {
  if (!installType) {
    return "Rojo is not installed."
  }

  if (mixed) {
    return "Rojo install method differs by project file."
  }

  const opinion =
    installType !== InstallType.Aftman ? " Consider switching to Aftman." : ""

  if (installType === InstallType.Global) {
    return "Rojo is globally installed." + opinion
  }

  return `Rojo is managed by ${installType}.` + opinion
}

async function generateProjectMenu(
  state: State,
  projectFiles: ProjectFile[]
): Promise<PickItem[]> {
  const projectFileRojoVersions: Map<typeof projectFiles[0], string | null> =
    new Map()
  const rojoVersions: { [index: string]: true } = {}

  let installType
  let mixed = false

  for (const projectFile of projectFiles) {
    const install = await getRojoInstall(projectFile)
    if (install) {
      rojoVersions[install.version] = true

      if (installType === undefined) {
        installType = install.installType
      } else if (installType !== install.installType) {
        mixed = true
      }
    }

    projectFileRojoVersions.set(projectFile, install ? install.version : null)
  }

  const allRojoVersions = Object.keys(rojoVersions)

  if (allRojoVersions.length === 0) {
    return rojoNotInstalled
  }

  const runningItems = Object.values(state.running).map(({ projectFile }) => ({
    label: `$(debug-stop) ${projectFile.name}`,
    description: projectFile.workspaceFolderName,
    projectFile,
    action: "stop",
    buttons: [openFileButton, buildButton],
  }))

  const isAnyRunning = Object.values(state.running).length > 0

  const projectFileItems: PickItem[] = []
  for (const projectFile of projectFiles) {
    const isInstalled = projectFileRojoVersions.get(projectFile) !== null
    const isRunning = projectFile.path.fsPath in state.running

    if (isRunning) {
      continue
    }

    projectFileItems.push({
      label: `$(${isInstalled ? "debug-start" : "warning"}) ${
        projectFile.name
      }`,
      description: projectFile.workspaceFolderName,
      detail: !isInstalled
        ? `        Rojo not detected in ${projectFile.workspaceFolderName}`
        : allRojoVersions.length > 1
        ? `v${projectFileRojoVersions.get(projectFile)}`
        : undefined,
      action: isInstalled ? "start" : undefined,
      projectFile,
      buttons: [
        ...(isInstalled && isAnyRunning ? [stopAndServeButton] : []),
        openFileButton,
        ...(isInstalled ? [buildButton] : []),
      ],
    })
  }

  return [
    {
      label: "$(rocket) Rojo",
      description:
        allRojoVersions.length === 1
          ? `v${allRojoVersions[0]}`
          : `${allRojoVersions.length} versions of Rojo installed`,
      detail: getInstallDetail(installType, mixed),
      info: true,
    },
    {
      label: "$(link-external) Open Rojo Docs",
      info: true,
      action: "openDocs",
    },
    {
      label: "―――――――――――― $(versions) Projects in this workspace ―――――――――――",
      detail:
        "Click to start live syncing, or build with the build button on the right.",
      info: true,
    },
    ...runningItems,
    ...projectFileItems,
  ]
}

export const openMenuCommand = (state: State) =>
  vscode.commands.registerCommand("vscode-rojo.openMenu", async () => {
    const projectFilesResult = await result(findProjectFiles())

    if (!projectFilesResult.ok) {
      vscode.window.showErrorMessage(projectFilesResult.error.toString())
      return
    }

    const projectFiles = projectFilesResult.result

    const input = vscode.window.createQuickPick()

    let pickItems: PickItem[]

    if (projectFiles.length === 0) {
      if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage(
          "You must open VS Code on a workspace folder to do this."
        )
        return
      }

      const firstFolder = vscode.workspace.workspaceFolders[0]

      const defaultProjectFile: ProjectFile = {
        name: "default.project.json",
        workspaceFolderName: firstFolder.name,
        path: vscode.Uri.joinPath(firstFolder.uri, "default.project.json"),
      }

      const install = await getRojoInstall(defaultProjectFile)

      if (install) {
        pickItems = [
          {
            label: "$(rocket) Rojo",
            detail: "This workspace contains no project files.",
            info: true,
          },
          {
            label: "$(new-file) Create one now",
            detail: "This will run the `rojo init` in your workspace folder.",
            action: "create",
            projectFile: defaultProjectFile,
          },
        ]
      } else {
        pickItems = rojoNotInstalled
      }
    } else {
      pickItems = await generateProjectMenu(state, projectFiles)
    }

    input.items = pickItems
    input.title = "Rojo"

    input.onDidTriggerItemButton(async (event) => {
      const item = event.item as PickItem
      if (!item.projectFile) {
        return
      }

      switch ((event.button as any).action) {
        case "open": {
          vscode.workspace
            .openTextDocument(item.projectFile.path)
            .then((doc) => vscode.window.showTextDocument(doc))
          break
        }
        case "build": {
          try {
            await buildProject(item.projectFile)
          } catch (e) {
            vscode.window.showErrorMessage(
              "Rojo build errored: " + (e as any).toString()
            )
          }
          break
        }
        case "stopAndServe": {
          for (const runningProject of Object.values(state.running)) {
            runningProject.stop()
          }

          try {
            serveProject(state, item.projectFile)
          } catch (e) {
            vscode.window.showErrorMessage(
              "Rojo: Something went wrong when starting rojo. Error: " +
                (e as any).toString()
            )
          }

          input.hide()

          break
        }
      }
    })

    input.onDidChangeValue((value) => {
      if (value.length > 0) {
        input.items = pickItems.filter((item) => !item.info)
      } else {
        input.items = pickItems
      }
    })

    input.onDidAccept(() => {
      const selectedItem = input.activeItems[0] as PickItem

      switch (selectedItem.action) {
        case "start": {
          try {
            serveProject(state, selectedItem.projectFile!)
          } catch (e) {
            vscode.window.showErrorMessage(
              "Rojo: Something went wrong when starting rojo. Error: " +
                (e as any).toString()
            )
          }

          input.hide()
          break
        }
        case "stop": {
          const running = state.running[selectedItem.projectFile!.path.fsPath]

          if (running) {
            try {
              running.stop()
            } catch (e) {
              vscode.window.showErrorMessage(
                "Rojo: Couldn't stop Rojo process. Error: " +
                  (e as any).toString()
              )
            }
          }

          input.hide()
          break
        }
        case "openDocs": {
          vscode.env.openExternal(
            vscode.Uri.parse("https://rojo.space/docs/v7/")
          )
          break
        }
        case "create": {
          if (!selectedItem.projectFile) {
            return
          }
          const folder = path.dirname(selectedItem.projectFile.path.fsPath)
          createProjectFile(folder)
            .then(() => {
              input.hide()
              vscode.commands.executeCommand("vscode-rojo.openMenu")
            })
            .catch((e) => {
              vscode.window.showErrorMessage(
                `Could not create Rojo project: ${e}`
              )
            })
          break
        }
        case "install": {
          if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage(
              "You must open VS Code on a workspace folder to do this."
            )
            return
          }

          const firstFolder = vscode.workspace.workspaceFolders[0]

          let folder = firstFolder.uri.fsPath

          if (selectedItem.projectFile) {
            folder = path.dirname(selectedItem.projectFile.name)
          }

          input.hide()

          installRojo(folder)
            .then(() => {
              vscode.window.showInformationMessage(
                "Successfully installed Rojo with Aftman!"
              )

              vscode.commands.executeCommand("vscode-rojo.openMenu")
            })
            .catch((e) => {
              vscode.window.showErrorMessage(
                `Couldn't install Rojo with Aftman: ${e}`
              )
            })

          break
        }
      }
    })

    input.show()
  })
