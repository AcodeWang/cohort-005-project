import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { LessonNote, type LessonNoteData } from "./lesson-note";

function render(note: LessonNoteData) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <LessonNote note={note} /> },
  ]);
  return renderToString(<Stub />);
}

describe("LessonNote", () => {
  it("posts the save-note intent from a form under a 'Your notes' heading", () => {
    const html = render(null);

    expect(html).toMatch(/<h2[^>]*>Your notes<\/h2>/);
    expect(html).toMatch(/<form[^>]*method="post"/);
    expect(html).toMatch(/name="intent" value="save-note"/);
    expect(html).toContain("Only you can read this.");
  });

  it("gives the textarea a height of its own, because field-sizing-content ignores rows", () => {
    const html = render(null);

    expect(html).toMatch(/<textarea[^>]*class="[^"]*\bmin-h-32\b/);
    expect(html).not.toMatch(/<textarea[^>]*\brows=/);
  });

  it("leaves the box empty and says nothing about edits when there is no note yet", () => {
    const html = render(null);

    expect(html).toMatch(/<textarea[^>]*name="body"[^>]*><\/textarea>/);
    expect(html).not.toContain("Last edited");
  });

  it("fills the box with the saved note and says when it was last edited", () => {
    const html = render({
      body: "Remember: unknown, not any.",
      updatedAt: new Date().toISOString(),
    });

    expect(html).toContain("Remember: unknown, not any.</textarea>");
    expect(html).toContain("Last edited");
  });
});
