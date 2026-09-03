import { fail } from "../utils/http.js";

export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return fail(res, 400, "Validation failed", {
      errors: result.error.issues.map(i => ({ path: i.path, message: i.message }))
    });
  }
  req[source] = result.data;
  next();
};
