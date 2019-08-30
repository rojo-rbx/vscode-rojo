import ua from 'universal-analytics'
import { ExtensionContext, extensions, Extension } from 'vscode'
import { v4 as generateUUID } from 'uuid'
import { isTelemetryEnabled } from './Util'

const ACCOUNT_ID = 'UA-88052542-2'
const EXT_ID = 'evaera.vscode-rojo'

export enum TelemetryEvent { PluginManagedChanged, InstallationError, InstallationSuccess, Installation, RuntimeError }

export default class Telemetry {
  private static visitor: ua.Visitor
  private static context: ExtensionContext

  static initialize (context: ExtensionContext) {
    if (isTelemetryEnabled() === false) return

    this.context = context
    this.visitor = ua(ACCOUNT_ID, this.getUUID(), {
      https: true
    })

    this.visitor.screenview('Startup', 'Rojo for VS Code', (extensions.getExtension(EXT_ID) as Extension<any>).packageJSON.version, err => err)
  }

  static getUUID (): string {
    const currentUUID = this.context.globalState.get('rojoUserUUID') as string
    if (currentUUID) return currentUUID

    const newUUID = generateUUID()
    this.context.globalState.update('rojoUserUUID', newUUID)

    return newUUID
  }

  static trackEvent (eventAction: TelemetryEvent, eventLabel: string, eventValue: any) {
    if (!this.visitor) return

    console.log(TelemetryEvent[eventAction], eventLabel, eventValue)

    this.visitor.event(TelemetryEvent[eventAction], eventLabel, eventValue, err => err)
  }

  static trackException (exception: string) {
    if (!this.visitor) return

    this.visitor.exception(exception)
  }
}
