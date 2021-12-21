import { State } from "./extension"

export function updateButton(state: State) {
  const numRunning = Object.keys(state.running).length

  if (numRunning === 0) {
    state.button.text = "$(rocket) Rojo"
  } else if (numRunning === 1) {
    state.button.text = `$(testing-run-all-icon) Rojo: serving`
  } else {
    state.button.text = `$(testing-run-all-icon) Rojo: ${numRunning} serving`
  }
}
