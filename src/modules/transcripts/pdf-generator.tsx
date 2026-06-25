import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export type TranscriptGradeRow = {
  termName: string;
  courseCode: string;
  courseTitle: string;
  creditHours: number;
  grade: string;
  qualityPoints: number | null;
};

export type TranscriptPdfData = {
  institution: {
    tenantId: string;
    institutionName: string;
  };
  studentName: string;
  studentId: string;
  programName: string;
  cumulativeGpa: number | null;
  creditsEarned: number;
  issuanceId: string;
  issuanceDate: string;
  gradeRows: TranscriptGradeRow[];
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  headerContainer: {
    marginBottom: 20,
  },
  institutionName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  institutionAddress: {
    fontSize: 10,
    marginBottom: 2,
  },
  horizontalRule: {
    borderBottom: "1pt solid #000",
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  studentSection: {
    marginBottom: 16,
  },
  studentRow: {
    fontSize: 10,
    marginBottom: 3,
  },
  studentLabel: {
    fontWeight: "bold",
  },
  gradeTableHeader: {
    flexDirection: "row",
    borderBottom: "1pt solid #000",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: "bold",
  },
  gradeTableRow: {
    flexDirection: "row",
    paddingBottom: 3,
    marginBottom: 3,
  },
  colTerm: {
    width: "15%",
  },
  colCode: {
    width: "15%",
  },
  colTitle: {
    width: "35%",
  },
  colCredits: {
    width: "12%",
    textAlign: "right",
  },
  colGrade: {
    width: "10%",
    textAlign: "center",
  },
  colQualityPoints: {
    width: "13%",
    textAlign: "right",
  },
  summarySection: {
    marginTop: 16,
    paddingTop: 8,
    borderTop: "1pt solid #000",
  },
  summaryRow: {
    fontSize: 10,
    marginBottom: 3,
  },
  summaryLabel: {
    fontWeight: "bold",
  },
  footerSection: {
    marginTop: 30,
    fontSize: 8,
    color: "#666",
  },
  footerRow: {
    marginBottom: 2,
  },
  noRecordsText: {
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 8,
    marginBottom: 8,
  },
});

function TranscriptDocument({ data }: { data: TranscriptPdfData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.institutionName}>
            {data.institution.institutionName}
          </Text>
          <View style={styles.horizontalRule} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Official Academic Transcript</Text>

        {/* Student Section */}
        <View style={styles.studentSection}>
          <View style={styles.studentRow}>
            <Text>
              <Text style={styles.studentLabel}>Student Name: </Text>
              {data.studentName}
            </Text>
          </View>
          <View style={styles.studentRow}>
            <Text>
              <Text style={styles.studentLabel}>Student ID: </Text>
              {data.studentId}
            </Text>
          </View>
          <View style={styles.studentRow}>
            <Text>
              <Text style={styles.studentLabel}>Program: </Text>
              {data.programName}
            </Text>
          </View>
        </View>

        {/* Grade Table */}
        {data.gradeRows.length === 0 ? (
          <Text style={styles.noRecordsText}>
            No grade records on file as of {data.issuanceDate}
          </Text>
        ) : (
          <>
            <View style={styles.gradeTableHeader}>
              <Text style={styles.colTerm}>Term</Text>
              <Text style={styles.colCode}>Course Code</Text>
              <Text style={styles.colTitle}>Title</Text>
              <Text style={styles.colCredits}>Credits</Text>
              <Text style={styles.colGrade}>Grade</Text>
              <Text style={styles.colQualityPoints}>Quality Pts</Text>
            </View>
            {data.gradeRows.map((row, index) => (
              <View key={index} style={styles.gradeTableRow}>
                <Text style={styles.colTerm}>{row.termName}</Text>
                <Text style={styles.colCode}>{row.courseCode}</Text>
                <Text style={styles.colTitle}>{row.courseTitle}</Text>
                <Text style={styles.colCredits}>
                  {row.creditHours.toFixed(1)}
                </Text>
                <Text style={styles.colGrade}>{row.grade}</Text>
                <Text style={styles.colQualityPoints}>
                  {row.qualityPoints !== null
                    ? row.qualityPoints.toFixed(2)
                    : "—"}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text>
              <Text style={styles.summaryLabel}>Total Credits Earned: </Text>
              {data.creditsEarned.toFixed(1)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>
              <Text style={styles.summaryLabel}>Cumulative GPA: </Text>
              {data.cumulativeGpa !== null
                ? data.cumulativeGpa.toFixed(2)
                : "N/A"}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerSection}>
          <View style={styles.footerRow}>
            <Text>Issuance ID: {data.issuanceId}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text>Issuance Date: {data.issuanceDate}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderTranscriptPdfBuffer(
  data: TranscriptPdfData,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(<TranscriptDocument data={data} /> as any);
}
