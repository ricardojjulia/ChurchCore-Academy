import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export type AidAwardLetterData = {
  institution: { institutionName: string };
  studentName: string;
  studentId: string;
  programName: string;
  academicYear: string;
  awards: { awardType: string; amount: number; duration: string }[];
  costOfAttendance: number | null;
  costOfAttendanceLabel: string;
  acceptanceDeadline: string | null;
  generatedAt: string;
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
  costsSection: {
    marginBottom: 16,
    paddingTop: 8,
    borderTop: "1pt solid #ccc",
  },
  costsRow: {
    fontSize: 10,
    marginBottom: 3,
  },
  awardsTableHeader: {
    flexDirection: "row",
    borderBottom: "1pt solid #000",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: "bold",
  },
  awardsTableRow: {
    flexDirection: "row",
    paddingBottom: 3,
    marginBottom: 3,
  },
  colType: {
    width: "40%",
  },
  colAmount: {
    width: "30%",
    textAlign: "right",
  },
  colDuration: {
    width: "30%",
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
  instructionsSection: {
    marginTop: 20,
    fontSize: 9,
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderRadius: 4,
  },
  instructionsTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  instructionsText: {
    marginBottom: 2,
  },
  footerSection: {
    marginTop: 30,
    fontSize: 8,
    color: "#666",
  },
  footerRow: {
    marginBottom: 2,
  },
  noAwardsText: {
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 8,
    marginBottom: 8,
  },
});

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function AidLetterDocument({ data }: { data: AidAwardLetterData }) {
  const totalAidCents = data.awards.reduce((sum, award) => sum + award.amount, 0);
  const netCost =
    data.costOfAttendance !== null
      ? data.costOfAttendance - totalAidCents
      : null;

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
        <Text style={styles.title}>Financial Aid Award Letter</Text>

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
          <View style={styles.studentRow}>
            <Text>
              <Text style={styles.studentLabel}>Academic Year: </Text>
              {data.academicYear}
            </Text>
          </View>
        </View>

        {/* Cost of Attendance */}
        {data.costOfAttendance !== null && (
          <View style={styles.costsSection}>
            <View style={styles.costsRow}>
              <Text>
                <Text style={styles.studentLabel}>
                  {data.costOfAttendanceLabel}:{" "}
                </Text>
                {formatCurrency(data.costOfAttendance)}
              </Text>
            </View>
          </View>
        )}

        {/* Awards Table */}
        {data.awards.length === 0 ? (
          <Text style={styles.noAwardsText}>
            No awards included in this package.
          </Text>
        ) : (
          <>
            <View style={styles.awardsTableHeader}>
              <Text style={styles.colType}>Award Type</Text>
              <Text style={styles.colAmount}>Amount</Text>
              <Text style={styles.colDuration}>Duration</Text>
            </View>
            {data.awards.map((award, index) => (
              <View key={index} style={styles.awardsTableRow}>
                <Text style={styles.colType}>{award.awardType}</Text>
                <Text style={styles.colAmount}>
                  {formatCurrency(award.amount)}
                </Text>
                <Text style={styles.colDuration}>{award.duration}</Text>
              </View>
            ))}
          </>
        )}

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text>
              <Text style={styles.summaryLabel}>Total Aid Awarded: </Text>
              {formatCurrency(totalAidCents)}
            </Text>
          </View>
          {netCost !== null && (
            <View style={styles.summaryRow}>
              <Text>
                <Text style={styles.summaryLabel}>Estimated Net Cost: </Text>
                {formatCurrency(netCost)}
              </Text>
            </View>
          )}
        </View>

        {/* Acceptance Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>Acceptance Instructions</Text>
          <Text style={styles.instructionsText}>
            Please review your award package carefully. To accept or decline
            these awards, log in to your student portal and navigate to the
            Financial Aid section.
          </Text>
          {data.acceptanceDeadline && (
            <Text style={styles.instructionsText}>
              Acceptance Deadline: {data.acceptanceDeadline}
            </Text>
          )}
          <Text style={styles.instructionsText}>
            If you have questions, please contact the Financial Aid Office.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footerSection}>
          <View style={styles.footerRow}>
            <Text>Generated: {data.generatedAt}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text>{data.institution.institutionName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderAidLetterPdfBuffer(
  data: AidAwardLetterData,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(<AidLetterDocument data={data} /> as any);
}
