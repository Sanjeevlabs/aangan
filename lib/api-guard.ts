// Wraps a route handler so a failed live-database write answers 503
// "save-failed" instead of a 500 or a false success. Server only.
import { DbWriteError } from "./family-db";

export function guardWrites<A extends unknown[]>(handler: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof DbWriteError) {
        console.error("[api] save failed", e.message);
        return Response.json({ error: "save-failed" }, { status: 503 });
      }
      throw e;
    }
  };
}
