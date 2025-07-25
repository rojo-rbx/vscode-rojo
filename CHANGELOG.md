# Change Log

All notable changes to the "vscode-rojo" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
### Added
- `rojo.additionalProjectPaths` setting to search for projects beyond workspace
  root.
- `rojo.projectPathDisplay` setting to manage how project paths are displayed in
  the project selection menu
- `rojo.showFullPaths` setting to show full path display for projects in the
  project selection menu

### Fixed
- Webpack build failure with dist directory creation
- Tool detection to avoid suggesting Aftman when Rokit is installed

## [2.1.2] - 2022-08-25
### Fixed
- Fixed error messages displaying as `[Object object]` in some cases

## [2.1.1] - 2022-08-13
### Fixed
- Extension now displays error message to user when the Rojo executable errors

## [2.1.0] - 2022-08-12

- Initial release
