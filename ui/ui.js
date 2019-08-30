/* global acquireVsCodeApi */

(function () {
  const vscode = acquireVsCodeApi()

  let state = {
    pluginManagement: null,
    pluginPath: '',
    isFolderOpen: true
  }

  function updateButton (element, state) {
    if (state) {
      element.classList.add('active')
    } else {
      element.classList.remove('active')
    }
  }

  function updateUi () {
    updateButton(document.querySelector('#manage-type-true'), state.pluginManagement === true)
    updateButton(document.querySelector('#manage-type-false'), state.pluginManagement === false)

    const pluginsPath = document.querySelector('#plugins-path')
    const mustChoose = document.querySelector('#must-choose')
    const news = document.querySelector('#news')

    if (state.pluginManagement === false) {
      pluginsPath.parentElement.classList.add('hidden')
    } else if (state.pluginManagement === true) { // it could be null
      pluginsPath.innerHTML = state.pluginPath
      pluginsPath.parentElement.classList.remove('hidden')
    }

    if (state.pluginManagement === null) {
      mustChoose.classList.add('alert')
      news.classList.add('hidden')
    } else {
      mustChoose.classList.remove('alert')
      news.classList.remove('hidden')
    }

    const folderAlert = document.querySelector('#folder-alert')

    if (state.isFolderOpen === true) {
      folderAlert.classList.add('hidden')
    } else {
      folderAlert.classList.remove('hidden')
    }
  }

  function requestState () {
    vscode.postMessage({ type: 'GET_STATE' })
  }

  function updateManagementStatus (isManaged) {
    vscode.postMessage({ type: 'SET_MANAGEMENT', value: isManaged })
    state.pluginManagement = isManaged
    updateUi()
  }

  function hookButton (element, state) {
    element.addEventListener('click', event => updateManagementStatus(state))
  }

  window.addEventListener('message', event => {
    const message = event.data

    switch (message.type) {
      case 'STATE':
        state = message.state
        updateUi()
        break
      default:
        throw new Error('Invalid IPC message type')
    }
  })

  document.addEventListener('DOMContentLoaded', event => {
    hookButton(document.querySelector('#manage-type-true'), true)
    hookButton(document.querySelector('#manage-type-false'), false)

    requestState()
  })
})()
