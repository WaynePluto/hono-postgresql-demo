import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  c.var.logger.error({ name: err.name, msg: err.message, stack: err.stack });
  return c.json({ code: 500, msg: err.message });
};
