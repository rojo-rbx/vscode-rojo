import * as childProcess from "child_process"
import { lstat } from "fs/promises"
import * as path from "path"
import { promisify } from "util"
import * as which from "which"

const exec = promisify(childProcess.exec)

async function isAftmanInstalled() {
  const aftmanPath = await which("aftman").catch(() => null)

  return !!aftmanPath
}

export async function installRojo(folder: string) {
  if (!isAftmanInstalled()) {
    throw new Error("Not implemented")
  }

  await exec("aftman trust rojo-rbx/rojo", {
    cwd: folder,
  })

  const aftmanToml = await lstat(path.join(folder, "aftman.toml")).catch(
    () => null
  )

  if (aftmanToml) {
    await exec("aftman install", {
      cwd: folder,
    })

    const output = await exec("rojo --version", {
      cwd: folder,
    }).catch(() => null)

    if (!output) {
      await exec("aftman add rojo-rbx/rojo", {
        cwd: folder,
      })
    }
  } else {
    await exec("aftman init", {
      cwd: folder,
    })

    await exec("aftman add rojo-rbx/rojo", {
      cwd: folder,
    })
  }
}
