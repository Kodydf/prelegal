import { buildNdaDocument } from "@/lib/nda-document";
import type { NdaFormData } from "@/types/nda";

export default function NdaPreview({ data }: { data: NdaFormData }) {
  const blocks = buildNdaDocument(data);

  return (
    <div className="rounded-lg border border-silver bg-white p-8 shadow-sm sm:p-12">
      <article className="mx-auto max-w-2xl font-serif text-black">
        {blocks.map((block, i) => {
          switch (block.type) {
            case "title":
              return (
                <h1 key={i} className="mb-6 text-center text-2xl font-bold">
                  {block.text}
                </h1>
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
                  {block.text}
                </p>
              );
            case "field":
              return (
                <div key={i} className="mb-4">
                  <h3 className="text-sm font-bold">{block.label}</h3>
                  {block.hint ? (
                    <p className="text-xs italic text-black/60">{block.hint}</p>
                  ) : null}
                  <p className="text-sm">{block.value}</p>
                </div>
              );
            case "choice":
              return (
                <div key={i} className="mb-4">
                  <h3 className="text-sm font-bold">{block.label}</h3>
                  {block.hint ? (
                    <p className="text-xs italic text-black/60">{block.hint}</p>
                  ) : null}
                  <ul className="mt-1 list-none">
                    {block.options.map((option, j) => (
                      <li key={j} className="text-sm">
                        {option.selected ? "[x]" : "[ ]"} {option.text}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            case "clause":
              return (
                <p key={i} className="mb-4 text-sm leading-relaxed">
                  <span className="font-bold">
                    {block.number}. {block.title}.{" "}
                  </span>
                  {block.body}
                </p>
              );
            case "table":
              return (
                <table key={i} className="mb-6 w-full border-collapse text-sm">
                  {block.headers.some((header) => header.length > 0) ? (
                    <thead>
                      <tr className="border-b border-silver">
                        {block.headers.map((header, hIdx) => (
                          <th
                            key={hIdx}
                            className={
                              hIdx === 0
                                ? "w-40 py-2 pr-4 text-left font-semibold text-black"
                                : "py-2 pr-4 text-left font-semibold text-black"
                            }
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-silver">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={
                              cIdx === 0
                                ? "w-40 py-2 pr-4 font-semibold text-black/60"
                                : "py-2 pr-4"
                            }
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            case "footer":
              return (
                <p key={i} className="mt-8 border-t border-silver pt-4 text-xs text-black/60">
                  {block.text}
                </p>
              );
            default:
              return null;
          }
        })}
      </article>
    </div>
  );
}
