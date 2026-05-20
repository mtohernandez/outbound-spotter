import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClerkCaptcha } from "./clerk-captcha";

describe("ClerkCaptcha", () => {
  it("renders the canonical #clerk-captcha mount point", () => {
    const { container } = render(<ClerkCaptcha />);
    const mount = container.querySelector("#clerk-captcha");

    expect(mount).not.toBeNull();
    expect(mount?.tagName).toBe("DIV");
  });
});
