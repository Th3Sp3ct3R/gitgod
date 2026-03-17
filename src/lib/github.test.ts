import { describe, it, expect } from "vitest";
import { parseGitHubUrl } from "./github.js";

describe("parseGitHubUrl", () => {
  it("extracts owner and repo from standard URL", () => {
    const result = parseGitHubUrl("https://github.com/user/repo");
    expect(result).toEqual({ owner: "user", repo: "repo" });
  });

  it("strips .git suffix", () => {
    const result = parseGitHubUrl("https://github.com/user/repo.git");
    expect(result).toEqual({ owner: "user", repo: "repo" });
  });

  it("handles URLs with trailing paths", () => {
    const result = parseGitHubUrl("https://github.com/user/repo#readme");
    expect(result).toEqual({ owner: "user", repo: "repo" });
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseGitHubUrl("https://gitlab.com/user/repo")).toBeNull();
    expect(parseGitHubUrl("https://example.com")).toBeNull();
  });
});
