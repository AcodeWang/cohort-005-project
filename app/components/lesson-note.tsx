import { useFetcher } from "react-router";
import { NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { formatRelativeTime } from "~/lib/utils";

export type LessonNoteData = { body: string; updatedAt: string } | null;

export function LessonNote({ note }: { note: LessonNoteData }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;

  return (
    <Card className="mb-8 gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NotebookPen className="size-4 text-muted-foreground" />
          <h2 id="lesson-note-title">Your notes</h2>
        </CardTitle>
        <CardDescription>Only you can read this.</CardDescription>
      </CardHeader>

      <CardContent>
        <fetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            aria-labelledby="lesson-note-title"
            defaultValue={note?.body ?? ""}
            placeholder="What do you want to remember from this lesson?"
            className="min-h-32 resize-y"
          />
          <div className="flex items-center justify-between gap-3">
            {error ? (
              <span role="alert" className="text-sm text-destructive">
                {error}
              </span>
            ) : note ? (
              <span
                suppressHydrationWarning
                className="text-xs text-muted-foreground"
              >
                Last edited {formatRelativeTime(note.updatedAt)}
              </span>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save note"}
            </Button>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}
