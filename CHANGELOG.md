# Release Notes

# 1.11.1

- Fix v0.6 restarting server on config change.

# 1.11.0
- Refactored extension code significantly.
- Support for future Rojo version 0.6.0.
- Fix schema being too strict for project files (#20).

# 1.10.1

- Fix a bug preventing startup.

# 1.10.0

- Handles releases with zipped executables

# 1.9.0

- Add $path or $className required to schema validator for .project.json(c) files.
- "Sync from here" option can now be used when the tree root is not DataModel.
- Fixed a bug where "Sync from here" did not add $className: Folder. (#16)
- Remove releaseType option, add releaseBranch option.
- Updated welcome screen with new content.
- A notification is now shown instead of opening the output window when starting Rojo. Errors will still cause the output window to open.

# 1.8.0

- Network errors when fetching new Rojo version are caught and the extension can now fall back to a previously installed version.
- Move install directory to a global folder outside of the extension installation.

# 1.7.1

- Fix issue with Sync From Here not working on 0.5.x

# 1.7.0

- Changing release type or target version no longer requires a reload to take effect.
- Provides a JSON validator for *.project.json files

# 1.6.0

- Add "View release notes" button when Rojo updates
- Add "Convert rojo.json" button when trying to start the server when default.project.json doesn't exist but rojo.json does
- Now functional on macOS again.

# 1.5.0

- Add Rojo build command
- Add convert from rojo.json to default.project.json

# 1.4.0

- Rojo v0.5.x is now supported! Check out [this page](https://lpghatguy.github.io/rojo/migrating-to-epiphany/) for details on how to migrate your project.
- To enable automatic pre-release downloads, open the extension settings panel and select the "pre-release" release type. Note: VS Code may need to be reloaded after this change.
- You can now target a specific Rojo version instead of the latest. Change the targetVersion setting to the tag name of the release you want to install (for example, v0.4.13). You can change this at the workspace level to lock projects to specific Rojo versions for compatibility.
- The "Rojo: Create Partition Here" context menu entry is now "Sync from here" and is compatible with both Rojo v0.4.x and v0.5.x.

# 1.3.0

- macOS support thanks to a PR from [Anton Matosov](https://github.com/anton-matosov).

# 1.2.5

- Added "Rojo: Create partition here..." context menu entry when right-clicking files or folders in the explorer.

# 1.2.1 - 1.2.4

- Adjusted welcome screen guide contents.

# 1.2.0

- Added new welcome screen with quick-start guide.
  - Forces users to pick if they want to manage the plugin, or if they want the extension to.
- Added plugin management and installation.
  - New setting `rojo.robloxStudioPluginsPath` if you have a weird plugins folder (default should be correct for 99% of people)/
- Added event logging to help track down any loose bugs that are encountered in the wild and for automatic detection of an invalid release.
  - Opt-out with `rojo.enableTelemetry` set to `false`.
- General code restructuring and improvements under the hood.

# 1.0.0

Initial release of vscode-rojo
