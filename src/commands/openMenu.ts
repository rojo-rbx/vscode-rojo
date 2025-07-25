import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { buildProject } from "../buildProject"
import { createProjectFile } from "../createProjectFile"
import { State } from "../extension"
import { findProjectFiles, ProjectFile } from "../findProjectFiles"
import { getRojoInstall, InstallType, RojoInstall } from "../getRojoInstall"
import { installPlugin } from "../installPlugin"
import { installRojo } from "../installRojo"
import { result } from "../result"
import { serveProject } from "../serveProject"
import {
  formatProjectDisplayNames,
  getWorkspaceFolderName,
  isExternalProject,
} from "../projectDisplay"
import { getConfigSetting, ThreeStateOption } from "../configuration"
import which = require("which")

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
    label: "$(comments-view-icon) Need help?",
    description: "Click to join the Roblox Open Source Discord",
    info: true,
    action: "openDiscord",
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

  if (installType === InstallType.global) {
    return "Rojo is globally installed."
  }

  return `Rojo is managed by ${installType}.`
}

let aftmanMessageSent = false

function showSwitchMessage(install: RojoInstall) {
  const installType = install.installType

  // Tell the user about Aftman once per session
  if (
    !(
      installType === InstallType.aftman || installType === InstallType.rokit
    ) &&
    !aftmanMessageSent
  ) {
    aftmanMessageSent = true

    let details = ""

    if (installType === InstallType.global) {
      details =
        " Aftman is a toolchain manager. " +
        "It enables installing project-specific command line tools and switching between them seamlessly."
    } else if (installType === InstallType.foreman) {
      details =
        " Aftman is similar to Foreman, but is more robust and easier to use. " +
        "Additionally, all currently-released versions of Foreman (as of v1.0.4) " +
        "have a bug that makes killing the launched Rojo process leave a Rojo process running forever."
    }

    vscode.window
      .showInformationMessage(
        `${getInstallDetail(
          installType,
          false
        )} You should consider using Aftman instead to manage your tool chains.` +
          details,
        "Switch to Aftman"
      )
      .then((response) => {
        if (!response) {
          return
        }

        vscode.window
          .showWarningMessage(
            `This will delete the rojo.exe in your path from ${install.resolvedPath}.` +
              ` After that, we will prompt you to install Rojo with Aftman. Is this OK?`,
            "Yes",
            "No"
          )
          .then((answer) => {
            if (answer !== "Yes") {
              return
            }

            // User might have multiple rojo's in their path, reset this to allow showing the message again
            aftmanMessageSent = false

            return fs.unlink(install.resolvedPath)
          })
          .then(
            () => {
              vscode.commands.executeCommand("vscode-rojo.openMenu")
            },
            (e) => {
              vscode.window.showErrorMessage(
                `Could not complete operation: ${e}`
              )
            }
          )
      })
  }
}

async function handleInstallError(error: string) {
  const location = await which("rojo").catch(() => null)

  vscode.window.showErrorMessage(
    `Trying to use Rojo executable found at ${
      location ?? "?"
    } resulted in an error: (${error}).` +
      `Fix or delete this file manually and try again.`
  )

  if (error.includes("Foreman") && location) {
    showSwitchMessage({
      installType: InstallType.foreman,
      resolvedPath: location,
      version: "?",
    })
  }
}

async function generateProjectMenu(
  state: State,
  projectFiles: ProjectFile[]
): Promise<PickItem[]> {
  const projectFileRojoVersions: Map<(typeof projectFiles)[0], string | null> =
    new Map()
  const rojoVersions: { [index: string]: true } = {}

  let installType
  let mixed = false

  let error: string | undefined

  for (const projectFile of projectFiles) {
    const installResult = await result<RojoInstall | null, string>(
      getRojoInstall(projectFile)
    )

    if (installResult.ok) {
      const install = installResult.result

      if (install) {
        rojoVersions[install.version] = true

        if (installType === undefined) {
          installType = install.installType
        } else if (installType !== install.installType) {
          mixed = true
        }

        showSwitchMessage(install)
      }

      projectFileRojoVersions.set(projectFile, install ? install.version : null)
    } else {
      error = installResult.error
    }
  }

  if (error) {
    handleInstallError(error)
  }

  const allRojoVersions = Object.keys(rojoVersions)

  if (allRojoVersions.length === 0) {
    return rojoNotInstalled
  }

  const allProjectFiles = [
    ...projectFiles,
    ...Object.values(state.running).map((r) => r.projectFile),
  ]
  const displayInfo = formatProjectDisplayNames(allProjectFiles)

  const runningItems = Object.values(state.running).map(({ projectFile }) => {
    const info = displayInfo.get(projectFile.path.fsPath)
    return {
      label: `$(debug-stop) ${info?.displayName ?? projectFile.name}`,
      description: getWorkspaceFolderName(projectFile),
      detail: (() => {
        const showFullPathMode = getConfigSetting("showFullPath")
        const shouldShowFullPath =
          showFullPathMode === ThreeStateOption.Always ||
          (showFullPathMode === ThreeStateOption.AsNeeded &&
            (isExternalProject(projectFile) || info?.wasTruncated))

        if (!shouldShowFullPath) {
          return undefined
        }

        if (isExternalProject(projectFile)) {
          return `Full path: ${projectFile.path.fsPath.replace(/\\/g, "/")}`
        } else if (
          showFullPathMode === ThreeStateOption.Always ||
          info?.wasTruncated
        ) {
          // For workspace projects: show full path if "always" mode or if truncated
          const pathToShow =
            showFullPathMode === ThreeStateOption.Always
              ? projectFile.path.fsPath.replace(/\\/g, "/")
              : info?.originalName
          return `Full path: ${pathToShow}`
        }
        return undefined
      })(),
      projectFile,
      action: "stop",
      buttons: [openFileButton, buildButton],
    }
  })

  const isAnyRunning = Object.values(state.running).length > 0

  const projectFileItems: PickItem[] = []
  for (const projectFile of projectFiles) {
    const isInstalled = projectFileRojoVersions.get(projectFile) !== null
    const isRunning = projectFile.path.fsPath in state.running

    if (isRunning) {
      continue
    }

    const info = displayInfo.get(projectFile.path.fsPath)

    const detailParts: string[] = []

    if (!isInstalled) {
      detailParts.push(
        `        Rojo not detected in ${getWorkspaceFolderName(projectFile)}`
      )
    } else if (allRojoVersions.length > 1) {
      detailParts.push(`v${projectFileRojoVersions.get(projectFile)}`)
    }

    // Show full path based on configuration
    const showFullPathMode = getConfigSetting("showFullPath")
    const shouldShowFullPath =
      showFullPathMode === ThreeStateOption.Always ||
      (showFullPathMode === ThreeStateOption.AsNeeded &&
        (isExternalProject(projectFile) || info?.wasTruncated))

    if (shouldShowFullPath) {
      if (isExternalProject(projectFile)) {
        const normalizedPath = projectFile.path.fsPath.replace(/\\/g, "/")
        detailParts.push(`Full path: ${normalizedPath}`)
      } else if (
        showFullPathMode === ThreeStateOption.Always ||
        info?.wasTruncated
      ) {
        // For workspace projects: show full path if "always" mode or if truncated
        const pathToShow =
          showFullPathMode === ThreeStateOption.Always
            ? projectFile.path.fsPath.replace(/\\/g, "/")
            : info?.originalName
        detailParts.push(`Full path: ${pathToShow}`)
      }
    }

    projectFileItems.push({
      label: `$(${isInstalled ? "debug-start" : "warning"}) ${
        info?.displayName ?? projectFile.name
      }`,
      description: getWorkspaceFolderName(projectFile),
      detail: detailParts.length > 0 ? detailParts.join(" • ") : undefined,
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
      label: "$(plug) Install Roblox Studio Plugin",
      description: "Click to install.",
      info: true,
      action: "installPlugin",
      projectFile: projectFiles[0],
    },
    {
      label: "$(link-external) Open Rojo Docs",
      info: true,
      action: "openDocs",
    },
    {
      label: "$(comments-view-icon) Need help?",
      description: "Click to join the Roblox Open Source Discord",
      info: true,
      action: "openDiscord",
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

      const installResult = await result<RojoInstall | null, string>(
        getRojoInstall(defaultProjectFile)
      )

      if (installResult.ok) {
        const install = installResult.result

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
        handleInstallError(installResult.error)

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
        case "openDiscord": {
          vscode.env.openExternal(
            vscode.Uri.parse("https://discord.gg/wH5ncNS")
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
        case "installPlugin": {
          if (!selectedItem.projectFile) {
            return
          }

          installPlugin(selectedItem.projectFile).catch((e) => {
            vscode.window.showErrorMessage(`Could not install plugin: ${e}`)
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
