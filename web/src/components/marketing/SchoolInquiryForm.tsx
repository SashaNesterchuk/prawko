"use client";

import { SUPPORTED_LOCALES } from "@prawko/config";
import { useActionState, useEffect, useRef } from "react";

import { submitSchoolInquiryAction } from "../../app/schools/actions";

const INITIAL_STATE = {
  message: "",
  status: "idle" as const,
};

export function SchoolInquiryForm({
  supportEmail,
}: {
  supportEmail: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    submitSchoolInquiryAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form action={formAction} className="form-stack" ref={formRef}>
      <input name="sourcePage" type="hidden" value="/schools" />

      <div aria-hidden="true" className="school-inquiry-honeypot">
        <label className="field">
          <span>Fax number</span>
          <input
            autoComplete="off"
            name="faxNumber"
            tabIndex={-1}
            type="text"
          />
        </label>
      </div>

      <div className="form-grid-two">
        <label className="field">
          <span>School name</span>
          <input
            name="organizationName"
            placeholder="Warsaw UA Driving School"
            required
          />
        </label>
        <label className="field">
          <span>Contact person</span>
          <input
            name="contactName"
            placeholder="Anna Kowalska"
            required
          />
        </label>
      </div>

      <div className="form-grid-two">
        <label className="field">
          <span>Work email</span>
          <input
            autoComplete="email"
            name="email"
            placeholder="anna@school.pl"
            required
            type="email"
          />
        </label>
        <label className="field">
          <span>Phone</span>
          <input
            autoComplete="tel"
            name="phone"
            placeholder="+48 500 000 000"
            type="tel"
          />
        </label>
      </div>

      <div className="form-grid-two">
        <label className="field">
          <span>City</span>
          <input name="city" placeholder="Warsaw" />
        </label>
        <label className="field">
          <span>Website</span>
          <input
            autoComplete="url"
            name="websiteUrl"
            placeholder="https://school.pl"
            type="url"
          />
        </label>
      </div>

      <div className="form-grid-two">
        <label className="field">
          <span>Approx. students in this pilot</span>
          <input
            max="5000"
            min="1"
            name="estimatedStudents"
            placeholder="25"
            type="number"
          />
        </label>
        <label className="field">
          <span>Current prep tool</span>
          <input
            name="currentSolution"
            placeholder="IMAGE / another app / paper access"
          />
        </label>
      </div>

      <fieldset className="admin-check-group">
        <legend>Student languages</legend>
        <div className="admin-option-grid">
          {SUPPORTED_LOCALES.map((locale) => (
            <label key={locale} className="admin-check-option">
              <input
                defaultChecked={locale === "ua" || locale === "pl"}
                name="studentLocales"
                type="checkbox"
                value={locale}
              />
              <span>{locale.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>What does the school need right now?</span>
        <textarea
          name="message"
          placeholder="Describe the cohort, timeline, and whether you want a short pilot, code access for a school, or a replacement for the current prep app."
          required
          rows={6}
        />
      </label>

      <p className="muted compact">
        Prefer direct email instead? Use{" "}
        <a className="inline-link" href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>
        .
      </p>

      {state.status !== "idle" ? (
        <p className={state.status === "success" ? "status success" : "status error"}>
          {state.message}
        </p>
      ) : null}

      <div className="action-row">
        <button className="primary-button" disabled={isPending} type="submit">
          {isPending ? "Sending request..." : "Send pilot request"}
        </button>
      </div>
    </form>
  );
}
