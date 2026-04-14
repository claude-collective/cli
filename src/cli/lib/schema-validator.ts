import { z } from "zod";

export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    if (issue.code === "unrecognized_keys") {
      return `Unrecognized key: "${issue.keys.join('", "')}"`;
    }
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
