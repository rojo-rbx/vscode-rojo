export function result<T, E = object>(
  promise: Promise<T>
): Promise<{ ok: true; result: T } | { ok: false; error: E }> {
  return promise
    .then((data: T): { ok: true; result: T } => ({
      ok: true,
      result: data,
    }))
    .catch((err: E) => {
      return {
        ok: false,
        error: err,
      }
    })
}
