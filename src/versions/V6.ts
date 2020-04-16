import { Version, VersionInfo } from "."
import { V06, V06Info } from "./V06"

export const V6Info: VersionInfo = {
  ...V06Info,

  name: "v6",

  cliOptions: ["--color", "never"],

  getPreviousVersionInfo() {
    return V06Info
  }
}

export class V6 extends V06 implements Version {
  public info = V6Info
}
