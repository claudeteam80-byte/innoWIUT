import { CalendarPlus, Link2, Mail, MessageCircle } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button-styles';
import { externalUrl, primaryContact, telegramUrl } from '@/domain/contact';
import { publicFileUrl } from '@/lib/storage';
import type { Mentor } from '../api';

export function MentorProfile({
  mentor,
  onRequestMeeting,
}: {
  mentor: Mentor;
  onRequestMeeting: () => void;
}) {
  const contact = primaryContact(mentor);
  const telegram = telegramUrl(mentor.telegram);
  const linkedin = externalUrl(mentor.linkedin_url);

  return (
    <section className="rounded-xl border border-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar
          name={mentor.name}
          src={publicFileUrl('mentor-photos', mentor.photo_path)}
          size="xl"
          shape="circle"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-[20px] font-semibold text-ink">{mentor.name}</h2>
            <p className="text-[13.5px] text-muted">{mentor.title || 'innoWIUT Mentor'}</p>
          </div>
          {mentor.expertise.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Expertise">
              {mentor.expertise.map((item) => (
                <li
                  key={item}
                  className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[12px] font-medium text-primary"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
          {mentor.bio && (
            <p className="whitespace-pre-line text-[13.5px] leading-6 text-ink">{mentor.bio}</p>
          )}
          <ul className="flex flex-col gap-2 text-[13px] sm:flex-row sm:flex-wrap sm:gap-x-5">
            {mentor.email && (
              <li>
                <a
                  href={`mailto:${mentor.email}`}
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" /> {mentor.email}
                </a>
              </li>
            )}
            {telegram && (
              <li>
                <a
                  href={telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> Telegram
                </a>
              </li>
            )}
            {linkedin && (
              <li>
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" /> LinkedIn
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="mt-5 grid gap-2 border-t border-line pt-5 sm:flex sm:justify-end">
        {contact ? (
          <a
            href={contact.href}
            {...(contact.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={buttonClasses({ variant: 'outline', className: 'w-full sm:w-auto' })}
          >
            <Mail aria-hidden="true" /> Contact Mentor
          </a>
        ) : (
          <Button variant="outline" disabled className="w-full sm:w-auto">
            No contact details yet
          </Button>
        )}
        <Button onClick={onRequestMeeting} className="w-full sm:w-auto">
          <CalendarPlus aria-hidden="true" /> Request Meeting
        </Button>
      </div>
    </section>
  );
}
