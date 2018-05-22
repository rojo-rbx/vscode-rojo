# Rojo for VS Code

This is a VS Code extension that gives you [Rojo](https://github.com/LPGhatguy/rojo) automatic installation and integration.

Only works on Windows (for now).

## How to use

- **If you are a new user**, please open the command panel (`Ctrl+Shift+P`) and run `Rojo: Open welcome screen` to see a guide.
- Otherwise, the extension will automatically activate whenever you have a `rojo.json` file in the root of your workspace or when you run a Rojo command.

## Features

- Automatically downloads the latest version of Rojo and keeps you up to date.
- Can automatically install the Roblox Studio plugin as well.
- Start and stop Rojo in one click, no need to touch the command line.
- Generates (and provides schema helpers for) rojo.json.
- Includes a quick start guide to help new users get started (`Rojo: Open welcome screen`)

## Requirements

- Windows

## Acknowledgements

- [LPGhatguy](https://github.com/LPGhatguy), for creating and maintaining Rojo.

## Known Issues

- None yet

## Release Notes

### 1.2.0

- Added new welcome screen with quick-start guide.
  - Forces users to pick if they want to manage the plugin, or if they want the extension to.
- Added plugin management and installation.
  - New setting `rojo.robloxStudioPluginsPath` if you have a weird plugins folder (default should be correct for 99% of people)/
- Added event logging to help track down any loose bugs that are encountered in the wild and for automatic detection of an invalid release.
  - Opt-out with `rojo.enableTelemetry` set to `false`.
- General code restructuring and improvements under the hood.

### 1.0.0

Initial release of vscode-rojo

## Goals

- [x] Add comments to code before I forget how it works
- [ ] Support macOS
- [ ] Better stability with fallback to known working binaries
- [x] Add a pop-up screen upon install telling the user to get the plugin
  - [x] Investigate auto-installing plugin with rbxmx to skip this step
