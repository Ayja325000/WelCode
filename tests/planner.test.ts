import { describe, expect, it } from "vitest";
import { HeuristicProvider } from "../src/core/provider";

describe("HeuristicProvider planner", () => {
  it("returns structured plan with thought, commands, and patch suggestion", async () => {
    const provider = new HeuristicProvider();
    const plan = await provider.planTask({
      task: "Please run build and test for this code task",
      workspacePath: "C:/workspace",
      constraints: ["keep safe"]
    });

    expect(typeof plan.thought).toBe("string");
    expect(Array.isArray(plan.commands)).toBe(true);
    expect(plan.commands.some((command) => command.includes("npm test"))).toBe(true);
    expect(plan.commands.some((command) => command.includes("npm run build"))).toBe(true);
    expect(plan.patchSuggestion.length).toBeGreaterThan(10);
  });
});
