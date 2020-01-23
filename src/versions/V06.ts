import { Version, VersionInfo } from "."
import { V05, V05Info } from "./V05"

export const V06Info: VersionInfo = {
  ...V05Info,

  name: "v0.6",

  configChangeRestartsRojo: false,

  getPreviousVersionInfo() {
    return V05Info
  }
}

export class V06 extends V05 implements Version {
  public info = V06Info
}
