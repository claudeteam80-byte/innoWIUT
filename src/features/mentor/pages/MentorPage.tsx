import { useState } from 'react';
import { MessageSquareText, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMyStartup } from '@/features/startup/hooks';
import { MeetingRequestDialog } from '../components/MeetingRequestDialog';
import { MeetingRequests } from '../components/MeetingRequests';
import { MentorNotes } from '../components/MentorNotes';
import { MentorProfile } from '../components/MentorProfile';
import { useAssignedMentor, useMeetingRequests, useMentorNotes } from '../hooks';

export function MentorPage() {
  const startup = useMyStartup();
  const startupId = startup.data?.id;
  const mentor = useAssignedMentor(startupId);
  const notes = useMentorNotes(startupId);
  const meetings = useMeetingRequests(startupId);
  const [requesting, setRequesting] = useState(false);

  const failed = startup.isError || mentor.isError || notes.isError || meetings.isError;
  const loading = startup.isPending || mentor.isPending || notes.isPending || meetings.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mentor"
        title="Your Mentor"
        subtitle="Guidance and contact details for your assigned innoWIUT mentor."
      />
      {failed ? (
        <ErrorState
          onRetry={() => {
            void startup.refetch();
            void mentor.refetch();
            void notes.refetch();
            void meetings.refetch();
          }}
        />
      ) : loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading mentor">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : !mentor.data ? (
        <EmptyState
          icon={UserRound}
          title="No mentor assigned yet"
          description="Your assigned innoWIUT mentor will appear here."
        />
      ) : (
        <>
          <MentorProfile mentor={mentor.data} onRequestMeeting={() => setRequesting(true)} />
          <Card>
            <CardHeader
              title="Mentor guidance"
              description="Notes from your mentor, most recent first."
            />
            {notes.data.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg bg-canvas px-4 py-8 text-center">
                <MessageSquareText className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="mt-2 text-[13.5px] font-medium text-ink">No notes yet</p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Guidance from your mentor will appear here.
                </p>
              </div>
            ) : (
              <MentorNotes notes={notes.data} mentorName={mentor.data.name} />
            )}
          </Card>
          <Card>
            <CardHeader title="Meeting requests" />
            {meetings.data.length === 0 ? (
              <p className="text-[13px] text-muted">You have not requested a meeting yet.</p>
            ) : (
              <MeetingRequests requests={meetings.data} />
            )}
          </Card>
          {startupId && (
            <MeetingRequestDialog
              open={requesting}
              onOpenChange={setRequesting}
              startupId={startupId}
              mentorId={mentor.data.id}
              mentorName={mentor.data.name}
            />
          )}
        </>
      )}
    </div>
  );
}
