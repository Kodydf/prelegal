import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { buildNdaDocument } from "@/lib/nda-document";
import type { NdaFormData } from "@/types/nda";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontSize: 10,
    lineHeight: 1.5,
    color: "#18181b",
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
    color: "#71717a",
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
    borderTop: "1pt solid #d4d4d8",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #d4d4d8",
    paddingVertical: 4,
  },
  tableLabelCell: {
    width: 110,
    fontWeight: 700,
    color: "#52525b",
  },
  tableCell: {
    flex: 1,
  },
  footer: {
    marginTop: 20,
    paddingTop: 8,
    borderTop: "1pt solid #d4d4d8",
    fontSize: 8,
    color: "#71717a",
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
