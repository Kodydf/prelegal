"use client";

import { useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import NdaPreview from "@/components/NdaPreview";
import DownloadButton from "@/components/DownloadButton";
import { defaultNdaFormData } from "@/lib/nda-defaults";
import type { NdaFormData } from "@/types/nda";

export default function NdaApp() {
  const [data, setData] = useState<NdaFormData>(defaultNdaFormData);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 lg:flex-row lg:items-start">
      <section className="w-full lg:sticky lg:top-10 lg:w-[420px] lg:shrink-0">
        <h1 className="text-xl font-semibold text-navy">Mutual NDA Creator</h1>
        <p className="mt-1 text-sm text-black/60">
          Chat with the assistant about your agreement. The document on the right fills in as
          you talk, and you can download it as a PDF when you&apos;re done.
        </p>
        <div className="mt-6">
          <ChatPanel data={data} onChange={setData} />
        </div>
        <div className="mt-6">
          <DownloadButton data={data} />
        </div>
      </section>

      <section className="min-w-0 flex-1">
        <NdaPreview data={data} />
      </section>
    </div>
  );
}
