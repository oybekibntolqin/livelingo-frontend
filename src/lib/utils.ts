// Small helper to compose class strings, dropping falsy values.
// Smaller than pulling in `clsx`.
export function cx(...args: Array<string | undefined | null | false>): string {
  return args.filter(Boolean).join(' ')
}
