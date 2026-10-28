"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { appSettingsAPI, getProductImageUrl, productsAPI, type SiteContent } from "../../../utils/api";

const FIELD_CLASS =
  "w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

type ContactForm = Pick<SiteContent, "contactPhone" | "contactEmail" | "contactHours" | "contactAddress">;

const EMPTY_CONTACT: ContactForm = { contactPhone: "", contactEmail: "", contactHours: "", contactAddress: "" };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Admin Settings cards for the storefront Contact Us page / footer and the Holiday Schedule page. */
export default function SiteContentSettings() {
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<ContactForm>(EMPTY_CONTACT);
  const [contactSaving, setContactSaving] = useState(false);
  const [holidayImageUrl, setHolidayImageUrl] = useState<string | null>(null);
  const [holidaySaving, setHolidaySaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    appSettingsAPI
      .get()
      .then((settings) => {
        if (cancelled) return;
        setContact({
          contactPhone: settings.contactPhone ?? "",
          contactEmail: settings.contactEmail ?? "",
          contactHours: settings.contactHours ?? "",
          contactAddress: settings.contactAddress ?? "",
        });
        setHolidayImageUrl(settings.holidayScheduleImageUrl ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(errorMessage(error, "Failed to load site content settings."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contact.contactPhone.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.contactEmail.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    try {
      setContactSaving(true);
      const settings = await appSettingsAPI.update(contact);
      setContact({
        contactPhone: settings.contactPhone ?? "",
        contactEmail: settings.contactEmail ?? "",
        contactHours: settings.contactHours ?? "",
        contactAddress: settings.contactAddress ?? "",
      });
      toast.success("Contact details updated.");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to update contact details."));
    } finally {
      setContactSaving(false);
    }
  };

  const saveHolidayImage = async (url: string | null) => {
    const settings = await appSettingsAPI.update({ holidayScheduleImageUrl: url ?? "" });
    setHolidayImageUrl(settings.holidayScheduleImageUrl ?? null);
  };

  const uploadHolidayImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      setHolidaySaving(true);
      const { url } = (await productsAPI.uploadImage(file)) as { url?: string };
      if (!url) throw new Error("Upload did not return an image URL.");
      await saveHolidayImage(url);
      toast.success("Holiday schedule image updated.");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to upload the image."));
    } finally {
      setHolidaySaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeHolidayImage = async () => {
    try {
      setHolidaySaving(true);
      await saveHolidayImage(null);
      toast.success("Holiday schedule image removed.");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to remove the image."));
    } finally {
      setHolidaySaving(false);
    }
  };

  const field = (key: keyof ContactForm, label: string, props: { placeholder: string; type?: string; hint?: string }) => (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">{label}</span>
      <input
        type={props.type ?? "text"}
        value={contact[key]}
        onChange={(e) => setContact((prev) => ({ ...prev, [key]: e.target.value }))}
        placeholder={props.placeholder}
        className={FIELD_CLASS}
      />
      {props.hint ? <span className="mt-1 block text-xs text-slate-500">{props.hint}</span> : null}
    </label>
  );

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-slate-900">Contact Details</h2>
        <p className="mt-1 text-sm text-slate-600">Shown on the Contact Us page, in the footer and in the policy pages.</p>

        <form onSubmit={saveContact} className="mt-6 space-y-4">
          <fieldset disabled={loading || contactSaving} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("contactPhone", "Phone", { placeholder: "1 (888) 739-8501" })}
            {field("contactEmail", "Email", { placeholder: "info@example.com", type: "email" })}
            <div className="sm:col-span-2">
              {field("contactHours", "Office hours", { placeholder: "Mon - Fri: 8:00am - 5:00pm PST" })}
            </div>
            <div className="sm:col-span-2">
              {field("contactAddress", "Address", {
                placeholder: "123 Main St, City, ST 00000",
                hint: "Optional. Leave empty to hide the address.",
              })}
            </div>
          </fieldset>
          <div className="flex items-center justify-end border-t border-slate-200 pt-4">
            <button
              type="submit"
              disabled={loading || contactSaving}
              className="inline-flex min-w-36 items-center justify-center rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {contactSaving ? "Saving..." : "Save Contact Details"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-slate-900">Holiday Schedule</h2>
        <p className="mt-1 text-sm text-slate-600">
          The image shown on the Holiday Schedule page. Upload a new one to replace it.
        </p>

        <div className="mt-6 space-y-4">
          {holidayImageUrl ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
              <Image
                src={getProductImageUrl(holidayImageUrl)}
                alt="Current holiday schedule"
                width={1200}
                height={900}
                unoptimized
                className="h-auto max-h-80 w-full rounded object-contain"
              />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              {loading ? "Loading…" : "No image yet. Customers see “Holiday schedule coming soon”."}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void uploadHolidayImage(e.target.files?.[0])}
            />
            {holidayImageUrl ? (
              <button
                type="button"
                onClick={() => void removeHolidayImage()}
                disabled={loading || holidaySaving}
                className="inline-flex items-center justify-center rounded-md border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove Image
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || holidaySaving}
              className="inline-flex min-w-36 items-center justify-center rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {holidaySaving ? "Saving..." : holidayImageUrl ? "Replace Image" : "Upload Image"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
