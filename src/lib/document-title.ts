import { useEffect } from 'react';

export const APP_TITLE = 'FounderTrack | innoWIUT';

/** Sets the browser tab title, e.g. "Traction · FounderTrack | innoWIUT". */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_TITLE}` : APP_TITLE;
  }, [title]);
}
