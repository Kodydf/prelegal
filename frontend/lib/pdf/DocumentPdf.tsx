import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { PDF_FOOTER } from "@/lib/disclaimer";
import { buildDocumentBlocks, splitBold } from "@/lib/document-model";
import type { DocumentDefinition, DocumentValues } from "@/types/document";

// The standard 14 PDF fonts (react-pdf's default) only support the WinAnsi/cp1252
// glyph repertoire, so any accented Latin, Cyrillic, Greek, etc. entered in the
// chat would silently drop or mis-render in the PDF while looking fine in the
// HTML preview. Registering a Unicode-capable font keeps the two outputs in sync.
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: "/fonts/NotoSans-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/NotoSans-Bold.ttf", fontWeight: 700 },
    { src: "/fonts/NotoSans-Italic.ttf", fontWeight: 400, fontStyle: "italic" },
  ],
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontFamily: "Noto Sans",
    fontSize: 10,
    lineHeight: 1.5,
    color: "#000000",
  },
  title: { fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 2 },
  subtitle: { fontSize: 10, textAlign: "center", textTransform: "uppercase", marginBottom: 16 },
  notice: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 14,
    padding: 8,
    border: "1pt solid #003366",
  },
  pageFooter: {
    position: "absolute",
    bottom: 22,
    left: 56,
    right: 56,
    textAlign: "center",
    fontSize: 8,
  },
  heading: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },
  paragraph: { marginBottom: 8 },
  fieldBlock: { marginBottom: 8 },
  fieldLabel: { fontWeight: 700 },
  fieldHint: { fontStyle: "italic", fontSize: 9 },
  bold: { fontWeight: 700 },
  term: { marginBottom: 6 },
  table: { marginTop: 8, marginBottom: 16, borderTop: "1pt solid #c0c0c0" },
  tableRow: { flexDirection: "row", borderBottom: "1pt solid #c0c0c0", paddingVertical: 4 },
  tableLabelCell: { width: 110, fontWeight: 700 },
  tableHeaderCell: { flex: 1, fontWeight: 700 },
  tableCell: { flex: 1 },
  footer: { marginTop: 20, paddingTop: 8, borderTop: "1pt solid #c0c0c0", fontSize: 8 },
});

function RichText({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, i) => (
        <Text key={i} style={part.bold ? styles.bold : undefined}>
          {part.text}
        </Text>
      ))}
    </>
  );
}

export default function DocumentPdf({
  definition,
  values,
}: {
  definition: DocumentDefinition;
  values: DocumentValues;
}) {
  const blocks = buildDocumentBlocks(definition, values);

  return (
    <Document title={definition.name}>
      <Page size="LETTER" style={styles.page}>
        {blocks.map((block, i) => {
          switch (block.type) {
            case "title":
              return (
                <Text key={i} style={styles.title}>
                  {block.text}
                </Text>
              );
            case "subtitle":
              return (
                <Text key={i} style={styles.subtitle}>
                  {block.text}
                </Text>
              );
            case "notice":
              return (
                <Text key={i} style={styles.notice}>
                  {block.text}
                </Text>
              );
            case "heading":
              return (
                <Text key={i} style={styles.heading}>
                  {block.text}
                </Text>
              );
            case "paragraph":
              return (
                <Text key={i} style={styles.paragraph}>
                  <RichText text={block.text} />
                </Text>
              );
            case "field":
              return (
                <View key={i} style={styles.fieldBlock} wrap={false}>
                  <Text style={styles.fieldLabel}>{block.label}</Text>
                  {block.hint ? <Text style={styles.fieldHint}>{block.hint}</Text> : null}
                  <Text>{block.value}</Text>
                </View>
              );
            case "table":
              return (
                <View key={i} style={styles.table} wrap={false}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabelCell}>{block.headers[0]}</Text>
                    {block.headers.slice(1).map((header, hIdx) => (
                      <Text key={hIdx} style={styles.tableHeaderCell}>
                        {header}
                      </Text>
                    ))}
                  </View>
                  {block.rows.map((row, rIdx) => (
                    <View key={rIdx} style={styles.tableRow}>
                      <Text style={styles.tableLabelCell}>{row[0]}</Text>
                      {row.slice(1).map((cell, cIdx) => (
                        <Text key={cIdx} style={styles.tableCell}>
                          {cell}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            case "term":
              return (
                <Text
                  key={i}
                  style={[
                    styles.term,
                    { marginLeft: Math.min(block.depth, 3) * 14, marginTop: block.depth === 0 ? 8 : 0 },
                  ]}
                >
                  <Text style={styles.bold}>
                    {block.number}
                    {block.title ? ` ${block.title}` : ""}
                  </Text>{" "}
                  <RichText text={block.text} />
                </Text>
              );
            case "footer":
              return (
                <Text key={i} style={styles.footer}>
                  {block.text}
                </Text>
              );
          }
        })}
        {/* Static text on purpose: a `render` function (e.g. page numbers) makes react-pdf's layout fail with
            "unsupported number" on the longest documents (Cloud Service and Software License Agreements). */}
        <Text style={styles.pageFooter} fixed>
          {PDF_FOOTER}
        </Text>
      </Page>
    </Document>
  );
}
