import { formatDate } from '@/domain/dates';
import type { MentorNote } from '../api';

export function MentorNotes({ notes, mentorName }: { notes: MentorNote[]; mentorName: string }) {
  return (
    <ol className="space-y-3">
      {notes.map((note) => (
        <li
          key={note.id}
          className="rounded-lg border-l-2 border-primary bg-canvas-subtle px-4 py-3"
        >
          <p className="whitespace-pre-line text-[13.5px] leading-6 text-ink">{note.body}</p>
          <p className="mt-2 text-[12px] text-muted">
            {mentorName} · {formatDate(note.note_date, 'long')}
          </p>
        </li>
      ))}
    </ol>
  );
}
