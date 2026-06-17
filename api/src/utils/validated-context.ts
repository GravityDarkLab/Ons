import type { Context, Input } from "hono";

/**
 * `Context` typed so `c.req.valid(target)` returns the validated shape
 * directly — avoids the `c.req.valid(x as never) as T` double-cast needed
 * for handlers that are wired to a `zValidator` in a route file but declared
 * with the untyped `Context` here.
 */
export type ValidatedContext<V extends Input["out"]> = Context<any, string, { out: V }>;
