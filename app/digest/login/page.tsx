import { safeNext } from '@/lib/digest/session'

export const dynamic = 'force-dynamic'

export default async function DigestLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
  return (
    <div className="digest-page">
      <h1 className="digest-title">Digest</h1>
      <form className="digest-login" method="post" action="/api/digest/login">
        {/* A username field lets password managers save and fill this login. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          defaultValue="stanley"
          hidden
          readOnly
        />
        <input type="hidden" name="next" value={safeNext(next)} />
        <label className="digest-meta" htmlFor="digest-password">
          Password
        </label>
        <div className="digest-field">
          <input
            id="digest-password"
            className="digest-input"
            type="password"
            name="password"
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'digest-error' : undefined}
            required
            autoFocus
          />
          <button
            className="link-quiet digest-quiet digest-enter"
            type="submit"
          >
            Enter
          </button>
        </div>
        {error && (
          <p id="digest-error" className="digest-meta" role="alert">
            Wrong password.
          </p>
        )}
      </form>
    </div>
  )
}
