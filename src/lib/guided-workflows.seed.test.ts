import { describe, expect, test } from "bun:test";
import { DEFAULT_GUIDED_WORKFLOWS } from "./guided-workflows.seed";
import {
  extractPlaceholderKeys,
  guidedWorkflowContentSchema,
  TOOL_LINK_ROUTES,
} from "./guided-workflows.schema";

function findDuplicates<T>(values: T[]): T[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

describe("DEFAULT_GUIDED_WORKFLOWS", () => {
  test("every guide satisfies the content schema", () => {
    const failures: string[] = [];

    for (const workflow of DEFAULT_GUIDED_WORKFLOWS) {
      const result = guidedWorkflowContentSchema.safeParse(workflow);
      if (result.success) continue;

      for (const issue of result.error.issues) {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        failures.push(`${workflow.slug} at ${path}: ${issue.message}`);
      }
    }

    expect(failures).toEqual([]);
  });

  test("slugs and sort orders are unique", () => {
    const duplicateSlugs = findDuplicates(
      DEFAULT_GUIDED_WORKFLOWS.map((workflow) => workflow.slug),
    );
    const duplicateSortOrders = findDuplicates(
      DEFAULT_GUIDED_WORKFLOWS.map((workflow) => workflow.sortOrder),
    );

    expect({
      duplicateSlugs,
      duplicateSortOrders,
    }).toEqual({
      duplicateSlugs: [],
      duplicateSortOrders: [],
    });
  });

  test("every tool link targets an allowlisted route", () => {
    const allowedRoutes = new Set<string>(TOOL_LINK_ROUTES);
    const invalidLinks: string[] = [];

    for (const workflow of DEFAULT_GUIDED_WORKFLOWS) {
      for (const step of workflow.steps) {
        if (step.toolLink && !allowedRoutes.has(step.toolLink.to)) {
          invalidLinks.push(
            `${workflow.slug} at steps.${step.id}.toolLink.to: ${step.toolLink.to}`,
          );
        }
      }
    }

    expect(invalidLinks).toEqual([]);
  });

  test("placeholder declarations exactly match prompt tokens", () => {
    const mismatches: string[] = [];

    for (const workflow of DEFAULT_GUIDED_WORKFLOWS) {
      for (const step of workflow.steps) {
        const declaredKeys = step.placeholders.map(({ key }) => key);
        const promptKeys = extractPlaceholderKeys(step.promptTemplate);
        const missingTokens = declaredKeys.filter((key) => !promptKeys.includes(key));
        const orphanTokens = promptKeys.filter((key) => !declaredKeys.includes(key));

        if (missingTokens.length > 0) {
          mismatches.push(
            `${workflow.slug} at steps.${step.id}.placeholders: declared but absent from promptTemplate: ${missingTokens.join(", ")}`,
          );
        }
        if (orphanTokens.length > 0) {
          mismatches.push(
            `${workflow.slug} at steps.${step.id}.promptTemplate: tokens without declarations: ${orphanTokens.join(", ")}`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});