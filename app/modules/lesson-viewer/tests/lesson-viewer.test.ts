import { describe, expect, it } from "vitest";
import { markdown } from "~/lib/text";
import { flattenCourseLessons, renderThread } from "../index.server";

const author = {
  id: 1,
  name: "Emma Wilson",
  avatarUrl: null,
  isInstructor: false,
  isPlatformAdmin: false,
};

type ThreadComment = Parameters<typeof renderThread>[0][number];

function comment(
  id: number,
  body: string,
  overrides: { deleted?: boolean; replies?: ThreadComment[] } = {}
): ThreadComment {
  return {
    id,
    body: markdown(body),
    createdAt: "2026-11-01T12:00:00.000Z",
    editedAt: null,
    deleted: overrides.deleted ?? false,
    author,
    replies: overrides.replies ?? [],
  };
}

describe("flattenCourseLessons", () => {
  it("lists every lesson in course order, each tagged with its module", () => {
    const flat = flattenCourseLessons({
      modules: [
        {
          id: 10,
          title: "Basics",
          lessons: [
            { id: 1, title: "Intro", moduleId: 10 },
            { id: 2, title: "Types", moduleId: 10 },
          ],
        },
        { id: 20, title: "Empty", lessons: [] },
        {
          id: 30,
          title: "Generics",
          lessons: [{ id: 3, title: "Constraints", moduleId: 30 }],
        },
      ],
    });

    expect(flat).toEqual([
      { id: 1, title: "Intro", moduleId: 10, moduleTitle: "Basics" },
      { id: 2, title: "Types", moduleId: 10, moduleTitle: "Basics" },
      { id: 3, title: "Constraints", moduleId: 30, moduleTitle: "Generics" },
    ]);
  });
});

describe("renderThread", () => {
  it("renders each comment's markdown, replies included", async () => {
    const [top] = await renderThread([
      comment(1, "Is **strict** on?", {
        replies: [comment(2, "Yes, *always*.")],
      }),
    ]);

    expect(top.bodyHtml).toContain("<strong>strict</strong>");
    expect(top.replies[0].bodyHtml).toContain("<em>always</em>");
  });

  it("sends no body for a deleted comment, but keeps its replies", async () => {
    const [top] = await renderThread([
      comment(1, "Gone", {
        deleted: true,
        replies: [comment(2, "Still here")],
      }),
    ]);

    expect(top.bodyHtml).toBe("");
    expect(top.replies[0].bodyHtml).toContain("Still here");
  });

  it("escapes raw HTML, because comments are untrusted", async () => {
    const [top] = await renderThread([
      comment(
        1,
        'Hi <script>alert("x")</script><img src=x onerror="alert(1)">'
      ),
    ]);

    expect(top.bodyHtml).not.toContain("<script");
    expect(top.bodyHtml).not.toContain("<img");
    expect(top.bodyHtml).toContain("&lt;script&gt;");
  });
});
