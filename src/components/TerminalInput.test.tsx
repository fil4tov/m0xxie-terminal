import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { TerminalInput } from "./TerminalInput";

function Input() {
  const [value, setValue] = useState("");
  return (
    <TerminalInput
      aria-label="Команда"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe("terminal underline caret", () => {
  it("keeps the underscore outside the actual command and tracks editing in the middle", () => {
    const { container } = render(<Input />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toHaveValue("");
    expect(container.querySelector(".terminal-input-caret")).toHaveTextContent(
      "_",
    );
    fireEvent.change(input, { target: { value: "/listen" } });
    expect(input).toHaveValue("/listen");
    expect(container.querySelector(".terminal-input-prefix")).toHaveTextContent(
      "/listen",
    );
    input.setSelectionRange(3, 3);
    fireEvent.keyUp(input, { key: "ArrowLeft" });
    expect(container.querySelector(".terminal-input-prefix")).toHaveTextContent(
      "/li",
    );
    fireEvent.change(input, { target: { value: "" } });
    expect(
      container.querySelector(".terminal-input-prefix"),
    ).toBeEmptyDOMElement();
  });

  it("follows horizontal scrolling and hides while text is selected", () => {
    const { container } = render(<Input />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a".repeat(80) } });
    input.scrollLeft = 120;
    fireEvent.scroll(input);
    expect(container.querySelector(".terminal-input-track")).toHaveStyle({
      transform: "translateX(-120px)",
    });
    input.setSelectionRange(1, 4);
    fireEvent.keyUp(input, { key: "ArrowRight" });
    expect(container.querySelector(".terminal-input-caret")).not.toBeVisible();
    input.setSelectionRange(4, 4);
    fireEvent.keyUp(input, { key: "ArrowRight" });
    expect(container.querySelector(".terminal-input-caret")).toBeVisible();
  });
});
