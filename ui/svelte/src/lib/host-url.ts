/*
 * Where the host lives.
 *
 * The Angular app resolves this to `window.location.origin` and nothing else
 * (app.config.ts), because the desktop UI is served by the host it talks to.
 * The indirection exists there so tests can substitute a resolver; here the
 * same seam is a plain function that a test can replace.
 */

export type HostUrlResolver = () => Promise<string | null>;

export const resolveHostUrl: HostUrlResolver = async () => window.location.origin;
