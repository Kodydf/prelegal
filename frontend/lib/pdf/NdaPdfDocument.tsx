import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { buildNdaDocument } from "@/lib/nda-document";
import type { NdaFormData } from "@/types/nda";

// The standard 14 PDF fonts (react-pdf's default) only support the WinAnsi/cp1252
// glyph repertoire, so any accented Latin, Cyrillic, Greek, etc. entered into the
// form would silently drop or mis-render in the PDF while looking fine in the
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
  title: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 20,
  },
  heading: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    marginBottom: 8,
  },
  fieldBlock: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontWeight: 700,
  },
  fieldHint: {
    fontStyle: "italic",
    color: "#000000",
    fontSize: 9,
  },
  choiceOption: {
    marginTop: 2,
  },
  clauseBold: {
    fontWeight: 700,
  },
  table: {
    marginTop: 8,
    marginBottom: 16,
    borderTop: "1pt solid #c0c0c0",
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #c0c0c0",
    paddingVertical: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #c0c0c0",
    paddingVertical: 4,
  },
  tableLabelCell: {
    width: 110,
    fontWeight: 700,
    color: "#000000",
  },
  tableCell: {
    flex: 1,
  },
  footer: {
    marginTop: 20,
    paddingTop: 8,
    borderTop: "1pt solid #c0c0c0",
    fontSize: 8,
    color: "#000000",
  },
});

export default function NdaPdfDocument({ data }: { data: NdaFormData }) {
  const blocks = buildNdaDocument(data);

  return (
    <Document title="Mutual Non-Disclosure Agreement">
      <Page size="LETTER" style={styles.page}>
        {blocks.map((block, i) => {
          switch (block.type) {
            case "title":
              return (
                <Text key={i} style={styles.title}>
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
                  {block.text}
                </Text>
              );
            case "field":
              return (
                <View key={i} style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{block.label}</Text>
                  {block.hint ? <Text style={styles.fieldHint}>{block.hint}</Text> : null}
                  <Text>{block.value}</Text>
                </View>
              );
            case "choice":
              return (
                <View key={i} style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{block.label}</Text>
                  {block.hint ? <Text style={styles.fieldHint}>{block.hint}</Text> : null}
                  {block.options.map((option, j) => (
                    <Text key={j} style={styles.choiceOption}>
                      {option.selected ? "[x]" : "[ ]"} {option.text}
                    </Text>
                  ))}
                </View>
              );
            case "clause":
              return (
                <Text key={i} style={styles.paragraph}>
                  <Text style={styles.clauseBold}>
                    {block.number}. {block.title}.{" "}
                  </Text>
                  {block.body}
                </Text>
              );
            case "table":
              return (
                <View key={i} style={styles.table}>
                  {block.headers.some((header) => header.length > 0) ? (
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableLabelCell, { color: "#000000" }]}>
                        {block.headers[0]}
                      </Text>
                      {block.headers.slice(1).map((header, hIdx) => (
                        <Text key={hIdx} style={styles.tableHeaderCell}>
                          {header}
                        </Text>
                      ))}
                    </View>
                  ) : null}
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
            case "footer":
              return (
                <Text key={i} style={styles.footer}>
                  {block.text}
                </Text>
              );
            default:
              return null;
          }
        })}
      </Page>
    </Document>
  );
}
