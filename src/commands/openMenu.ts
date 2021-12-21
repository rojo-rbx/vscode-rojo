import * as vscode from "vscode"
import { buildProject } from "../buildProject"
import { State } from "../extension"
import { findProjectFiles, ProjectFile } from "../findProjectFiles"
import { getRojoVersion } from "../getRojoVersion"
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

type PickItem = {
  label: string
  description: string
  detail: string | undefined
  action: string | undefined
  projectFile: ProjectFile
  buttons: {
    iconPath: vscode.ThemeIcon
    tooltip: string
  }[]
}

export const openMenuCommand = (state: State) =>
  vscode.commands.registerCommand("vscode-rojo.openMenu", async () => {
    const projectFilesResult = await result(findProjectFiles())

    if (!projectFilesResult.ok) {
      vscode.window.showErrorMessage(projectFilesResult.error.toString())
      return
    }

    const projectFiles = projectFilesResult.result

    const projectFileRojoVersions: Map<typeof projectFiles[0], string | null> =
      new Map()
    const rojoVersions: { [index: string]: true } = {}

    for (const projectFile of projectFiles) {
      const version = await getRojoVersion(projectFile)
      if (version) {
        rojoVersions[version] = true
      }

      projectFileRojoVersions.set(projectFile, version)
    }

    const allRojoVersions = Object.keys(rojoVersions)

    const runningItems = Object.values(state.running).map(
      ({ projectFile }) => ({
        label: `$(debug-stop) ${projectFile.name}`,
        description: projectFile.workspaceFolderName,
        projectFile,
        action: "stop",
        buttons: [openFileButton, buildButton],
      })
    )

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

    const input = vscode.window.createQuickPick()

    input.title = "Rojo"

    const pickItems: {
      label: string
      description?: string
      detail?: string
      action?: string
      info?: boolean
    }[] = [
      {
        label: "$(rocket) Rojo",
        description:
          allRojoVersions.length === 1
            ? `v${allRojoVersions[0]}`
            : `${allRojoVersions.length} versions of Rojo installed`,
        detail: "Using Rojo detected from aftman.toml",
        info: true,
      },
      {
        label: "$(link-external) Open Rojo Docs",
        info: true,
        action: "openDocs",
      },
      {
        label:
          "―――――――――――― $(versions) Projects in this workspace ―――――――――――",
        detail:
          "Click to start live syncing, or build with the build button on the right.",
        info: true,
      },
      ...runningItems,
      ...projectFileItems,
    ]

    input.items = pickItems

    input.onDidTriggerItemButton(async (event) => {
      const item = event.item as typeof projectFileItems[0]
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
      const selectedItem = input.activeItems[0] as typeof projectFileItems[0]

      switch (selectedItem.action) {
        case "start": {
          try {
            serveProject(state, selectedItem.projectFile)
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
          const running = state.running[selectedItem.projectFile.path.fsPath]

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
      }
    })

    input.show()
  })
