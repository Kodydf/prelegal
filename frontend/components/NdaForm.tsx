"use client";

import type { ChangeEvent } from "react";
import type { NdaFormData, PartyDetails } from "@/types/nda";

interface NdaFormProps {
  data: NdaFormData;
  onChange: (data: NdaFormData) => void;
}

const labelClass = "block text-sm font-medium text-black";
const hintClass = "text-xs text-black/60";
const inputClass =
  "mt-1 block w-full rounded-md border border-silver px-3 py-2 text-sm shadow-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy";

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

interface YearsOrOtherChoiceProps {
  legend: string;
  hint: string;
  name: string;
  yearsOptionSelected: boolean;
  onSelectYearsOption: () => void;
  years: number;
  onYearsChange: (years: number) => void;
  yearsPrefix?: string;
  yearsSuffix: string;
  otherOptionSelected: boolean;
  onSelectOtherOption: () => void;
  otherLabel: string;
}

function YearsOrOtherChoice({
  legend,
  hint,
  name,
  yearsOptionSelected,
  onSelectYearsOption,
  years,
  onYearsChange,
  yearsPrefix,
  yearsSuffix,
  otherOptionSelected,
  onSelectOtherOption,
  otherLabel,
}: YearsOrOtherChoiceProps) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <p className={hintClass}>{hint}</p>
      <div className="mt-2 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-black">
          <input
            type="radio"
            name={name}
            checked={yearsOptionSelected}
            onChange={onSelectYearsOption}
          />
          {yearsPrefix}
          <input
            className="w-16 rounded-md border border-silver px-2 py-1 text-sm"
            type="number"
            min={0}
            value={years}
            onChange={(e) => onYearsChange(Math.max(0, Number(e.target.value) || 0))}
            disabled={!yearsOptionSelected}
          />
          {yearsSuffix}
        </label>
        <label className="flex items-center gap-2 text-sm text-black">
          <input
            type="radio"
            name={name}
            checked={otherOptionSelected}
            onChange={onSelectOtherOption}
          />
          {otherLabel}
        </label>
      </div>
    </fieldset>
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
    <fieldset className="rounded-lg border border-silver p-4">
      <legend className="px-1 text-sm font-semibold text-black">{title}</legend>
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

      <YearsOrOtherChoice
        legend="MNDA Term"
        hint="The length of this MNDA"
        name="mndaTermType"
        yearsOptionSelected={data.mndaTermType === "expires"}
        onSelectYearsOption={() => update("mndaTermType", "expires")}
        years={data.mndaTermYears}
        onYearsChange={(years) => update("mndaTermYears", years)}
        yearsPrefix="Expires"
        yearsSuffix="year(s) from Effective Date."
        otherOptionSelected={data.mndaTermType === "continues"}
        onSelectOtherOption={() => update("mndaTermType", "continues")}
        otherLabel="Continues until terminated in accordance with the terms of the MNDA."
      />

      <YearsOrOtherChoice
        legend="Term of Confidentiality"
        hint="How long Confidential Information is protected"
        name="confidentialityTermType"
        yearsOptionSelected={data.confidentialityTermType === "years"}
        onSelectYearsOption={() => update("confidentialityTermType", "years")}
        years={data.confidentialityTermYears}
        onYearsChange={(years) => update("confidentialityTermYears", years)}
        yearsSuffix="year(s) from Effective Date (or until a trade secret no longer qualifies as one)."
        otherOptionSelected={data.confidentialityTermType === "perpetuity"}
        onSelectOtherOption={() => update("confidentialityTermType", "perpetuity")}
        otherLabel="In perpetuity."
      />

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
