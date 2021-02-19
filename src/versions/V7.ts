import { Version, VersionInfo } from "."
import { V6, V6Info } from "./V6"

export const V7Info: VersionInfo = {
  ...V6Info,

  name: "v7",

  getPreviousVersionInfo() {
    return V6Info
  }
}

export class V7 extends V6 implements Version {
  public info = V7Info
}
