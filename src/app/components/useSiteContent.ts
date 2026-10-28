"use client";

import { useEffect, useState } from "react";
import { appSettingsAPI, type SiteContent } from "../../utils/api";

/** Same defaults as the backend, so the footer never renders blank while loading or offline. */
export const DEFAULT_SITE_CONTENT: SiteContent = {
  contactPhone: "1 (888) 739-8501",
  contactEmail: "info@resourcefulDigital.com",
  contactHours: "Mon - Fri: 8:00am - 5:00pm PST",
  contactAddress: "",
  holidayScheduleImageUrl: null,
};

/** One request per page load, shared by the footer and the page using the hook. */
let cachedRequest: Promise<SiteContent> | null = null;

function loadSiteContent(): Promise<SiteContent> {
  if (!cachedRequest) {
    cachedRequest = appSettingsAPI
      .getSiteContent()
      .then((content) => ({ ...DEFAULT_SITE_CONTENT, ...content }))
      .catch(() => {
        cachedRequest = null;
        return DEFAULT_SITE_CONTENT;
      });
  }
  return cachedRequest;
}

/** Admin-editable contact details and holiday schedule image. `loaded` turns true once the server answered. */
export function useSiteContent(): SiteContent & { loaded: boolean } {
  const [state, setState] = useState<SiteContent & { loaded: boolean }>({ ...DEFAULT_SITE_CONTENT, loaded: false });

  useEffect(() => {
    let cancelled = false;
    void loadSiteContent().then((content) => {
      if (!cancelled) setState({ ...content, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** `tel:` link for a display phone number such as "1 (888) 739-8501". */
export function phoneHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "#";
}
