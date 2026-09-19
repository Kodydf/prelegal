import { buildDocumentBlocks, splitBold } from "@/lib/document-model";
import type { DocumentDefinition, DocumentValues } from "@/types/document";

function RichText({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, i) =>
        part.bold ? <strong key={i}>{part.text}</strong> : <span key={i}>{part.text}</span>,
      )}
    </>
  );
}

const INDENT = ["", "ml-4", "ml-8", "ml-12"];

export default function DocumentPreview({
  definition,
  values,
}: {
  definition: DocumentDefinition;
  values: DocumentValues;
}) {
  const blocks = buildDocumentBlocks(definition, values);

  return (
    <div className="rounded-lg border border-silver bg-white p-8 shadow-sm sm:p-12">
      <article className="mx-auto max-w-2xl font-serif text-black">
        {blocks.map((block, i) => {
          switch (block.type) {
            case "title":
              return (
                <h1 key={i} className="mb-1 text-center text-2xl font-bold">
                  {block.text}
                </h1>
              );
            case "subtitle":
              return (
                <p key={i} className="mb-6 text-center text-sm uppercase tracking-widest text-black/60">
                  {block.text}
                </p>
              );
            case "heading":
              return (
                <h2 key={i} className="mb-3 mt-8 text-lg font-bold uppercase tracking-wide">
                  {block.text}
                </h2>
              );
            case "paragraph":
              return (
                <p key={i} className="mb-4 text-sm leading-relaxed">
                  <RichText text={block.text} />
                </p>
              );
            case "field":
              return (
                <div key={i} className="mb-4">
                  <h3 className="text-sm font-bold">{block.label}</h3>
                  {block.hint ? <p className="text-xs italic text-black/60">{block.hint}</p> : null}
                  <p className="whitespace-pre-wrap text-sm">{block.value}</p>
                </div>
              );
            case "table":
              return (
                <table key={i} className="mb-6 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-silver">
                      {block.headers.map((header, hIdx) => (
                        <th key={hIdx} className="py-2 pr-4 text-left font-semibold text-black">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-silver">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={cIdx === 0 ? "w-36 py-2 pr-4 font-semibold text-black/60" : "py-2 pr-4"}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            case "term":
              return (
                <p
                  key={i}
                  className={`${INDENT[Math.min(block.depth, 3)]} ${block.depth === 0 ? "mt-6" : ""} mb-3 text-sm leading-relaxed`}
                >
                  <span className="font-bold">
                    {block.number}
                    {block.title ? ` ${block.title}` : ""}
                  </span>{" "}
                  <RichText text={block.text} />
                </p>
              );
            case "footer":
              return (
                <p key={i} className="mt-8 border-t border-silver pt-4 text-xs text-black/60">
                  {block.text}
                </p>
              );
          }
        })}
      </article>
    </div>
  );
}
