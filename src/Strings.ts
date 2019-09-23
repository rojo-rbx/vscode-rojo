// A file containing various configuration and user-facing text strings.
// TODO: Pull more text out of the source code and add it here.
// TODO: Add configurations for "rojo.json"

export const TEXT_DOWNLOADING = "$(cloud-download) Downloading Rojo..."
export const TEXT_UPDATING = "$(sync) Checking for Rojo update..."
export const TEXT_INSTALLING = "$(sync) Installing Rojo using cargo..."
export const TEXT_START = "$(zap) Start Rojo"
export const TEXT_RUNNING = "$(eye) Rojo"

export const ROJO_GIT_URL = "https://github.com/rojo-rbx/rojo.git"
export const RELEASE_URL = "https://latest-rojo-release.3.workers.dev"
export const BINARY_NAME = "rojo.exe"
export const BINARY_PATTERN = /^rojo\.exe$/
export const BINARY_ZIP_PATTERN = /^rojo(?:-|-.*-)win64.zip$/
export const PLUGIN_PATTERN = /.+\.rbxmx?/

export const VALID_SERVICES = [
  "AssetService",
  "BadgeService",
  "ChangeHistoryService",
  "Chat",
  "CollectionService",
  "ContentProvider",
  "ContextActionService",
  "CoreGui",
  "DataStoreService",
  "Debris",
  "GamePassService",
  "GroupService",
  "GuiService",
  "HapticService",
  "HttpService",
  "InsertService",
  "JointsService",
  "KeyboardService",
  "KeyframeSequenceProvider",
  "Lighting",
  "LogService",
  "MarketplaceService",
  "MouseService",
  "NetworkClient",
  "NetworkServer",
  "PathfindingService",
  "PhysicsService",
  "Players",
  "PointsService",
  "ReplicatedFirst",
  "ReplicatedStorage",
  "RunService",
  "ScriptContext",
  "Selection",
  "ServerScriptService",
  "ServerStorage",
  "SoundService",
  "StarterGui",
  "StarterPack",
  "StarterPlayer",
  "Stats",
  "Teams",
  "TeleportService",
  "TestService",
  "TextService",
  "TweenService",
  "UserInputService",
  "VRService",
  "Workspace"
]
