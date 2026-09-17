"use client";

import type { ChangeEvent } from "react";
import type { NdaFormData, PartyDetails } from "@/types/nda";

interface NdaFormProps {
  data: NdaFormData;
  onChange: (data: NdaFormData) => void;
}

const labelClass = "block text-sm font-medium text-zinc-700";
const hintClass = "text-xs text-zinc-500";
const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {hint ? <span className={`block ${hintClass}`}>{hint}</span> : null}
      {children}
    </label>
  );
}

function PartyFields({
  title,
  party,
  onChange,
}: {
  title: string;
  party: PartyDetails;
  onChange: (party: PartyDetails) => void;
}) {
  const handleField =
    (key: keyof PartyDetails) => (e: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...party, [key]: e.target.value });
    };

  return (
    <fieldset className="rounded-lg border border-zinc-200 p-4">
      <legend className="px-1 text-sm font-semibold text-zinc-900">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Print Name">
          <input
            className={inputClass}
            type="text"
            value={party.printName}
            onChange={handleField("printName")}
          />
        </Field>
        <Field label="Title">
          <input
            className={inputClass}
            type="text"
            value={party.title}
            onChange={handleField("title")}
          />
        </Field>
        <Field label="Company">
          <input
            className={inputClass}
            type="text"
            value={party.company}
            onChange={handleField("company")}
          />
        </Field>
        <Field label="Date">
          <input
            className={inputClass}
            type="text"
            placeholder="e.g. September 17, 2026"
            value={party.date}
            onChange={handleField("date")}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notice Address" hint="Use either email or postal address">
            <input
              className={inputClass}
              type="text"
              value={party.noticeAddress}
              onChange={handleField("noticeAddress")}
            />
          </Field>
        </div>
      </div>
    </fieldset>
  );
}

export default function NdaForm({ data, onChange }: NdaFormProps) {
  const update = <K extends keyof NdaFormData>(key: K, value: NdaFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
      <Field label="Purpose" hint="How Confidential Information may be used">
        <textarea
          className={inputClass}
          rows={2}
          value={data.purpose}
          onChange={(e) => update("purpose", e.target.value)}
        />
      </Field>

      <Field label="Effective Date">
        <input
          className={inputClass}
          type="text"
          placeholder="e.g. September 17, 2026"
          value={data.effectiveDate}
          onChange={(e) => update("effectiveDate", e.target.value)}
        />
      </Field>

      <fieldset>
        <legend className={labelClass}>MNDA Term</legend>
        <p className={hintClass}>The length of this MNDA</p>
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="mndaTermType"
              checked={data.mndaTermType === "expires"}
              onChange={() => update("mndaTermType", "expires")}
            />
            Expires
            <input
              className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm"
              type="number"
              min={0}
              value={data.mndaTermYears}
              onChange={(e) => update("mndaTermYears", Number(e.target.value))}
              disabled={data.mndaTermType !== "expires"}
            />
            year(s) from Effective Date.
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="mndaTermType"
              checked={data.mndaTermType === "continues"}
              onChange={() => update("mndaTermType", "continues")}
            />
            Continues until terminated in accordance with the terms of the MNDA.
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Term of Confidentiality</legend>
        <p className={hintClass}>How long Confidential Information is protected</p>
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="confidentialityTermType"
              checked={data.confidentialityTermType === "years"}
              onChange={() => update("confidentialityTermType", "years")}
            />
            <input
              className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm"
              type="number"
              min={0}
              value={data.confidentialityTermYears}
              onChange={(e) => update("confidentialityTermYears", Number(e.target.value))}
              disabled={data.confidentialityTermType !== "years"}
            />
            year(s) from Effective Date (or until a trade secret no longer qualifies as one).
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="confidentialityTermType"
              checked={data.confidentialityTermType === "perpetuity"}
              onChange={() => update("confidentialityTermType", "perpetuity")}
            />
            In perpetuity.
          </label>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Governing Law">
          <input
            className={inputClass}
            type="text"
            placeholder="e.g. Delaware"
            value={data.governingLaw}
            onChange={(e) => update("governingLaw", e.target.value)}
          />
        </Field>
        <Field label="Jurisdiction">
          <input
            className={inputClass}
            type="text"
            placeholder="e.g. courts located in New Castle, DE"
            value={data.jurisdiction}
            onChange={(e) => update("jurisdiction", e.target.value)}
          />
        </Field>
      </div>

      <Field label="MNDA Modifications" hint="List any modifications to the MNDA (optional)">
        <textarea
          className={inputClass}
          rows={3}
          value={data.modifications}
          onChange={(e) => update("modifications", e.target.value)}
        />
      </Field>

      <PartyFields
        title="Party 1"
        party={data.partyOne}
        onChange={(party) => update("partyOne", party)}
      />
      <PartyFields
        title="Party 2"
        party={data.partyTwo}
        onChange={(party) => update("partyTwo", party)}
      />
    </form>
  );
}
