export async function PromiseObject<T extends object>(promises: T) {
  const result = {} as {
    [P in keyof T]: Awaited<T[P]>
  }
  for (const [key, promise] of Object.entries(promises)) {
    result[key as keyof T] = await promise
  }
  return result
}
