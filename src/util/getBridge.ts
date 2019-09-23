import { Bridge } from "../Bridge"
import { extensionContext, statusButton } from "../extension"

let currentBridge: Promise<Bridge | undefined> | undefined

export function getBridge() {
  if (currentBridge) return currentBridge
  currentBridge = Bridge.new(extensionContext, statusButton)
  return currentBridge
}

export function resetBridge() {
  currentBridge = undefined
}
