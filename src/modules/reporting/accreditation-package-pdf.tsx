import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export type AccreditationPackageData = {
  institutionName: string;
  accreditorName: string;
  reportCycle: string;
  packageType: string;
  generatedAt: string;
  programs: Array<{ name: string; code: string; enrollmentCount: number }>;
  totalEnrollment: number;
  facultyCount: number;
  graduationCount: number;
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
    borderBottom: "1pt solid #ccc",
    paddingBottom: 2,
  },
  row: {
    fontSize: 10,
    marginBottom: 3,
  },
  label: {
    fontWeight: "bold",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1pt solid #000",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingBottom: 3,
    marginBottom: 3,
  },
  colCode: {
    width: "20%",
  },
  colName: {
    width: "60%",
  },
  colCount: {
    width: "20%",
    textAlign: "right",
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  summaryBox: {
    width: "30%",
    padding: 8,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#666",
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
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
  noDataText: {
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 8,
  },
});

function AccreditationDocument({ data }: { data: AccreditationPackageData }) {
  const packageTypeLabels: Record<string, string> = {
    self_study: "Self-Study",
    annual_report: "Annual Report",
    site_visit_prep: "Site Visit Preparation",
    focused_evaluation: "Focused Evaluation",
  };

  const packageTypeLabel = packageTypeLabels[data.packageType] ?? data.packageType;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.institutionName}>{data.institutionName}</Text>
          <View style={styles.horizontalRule} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Accreditation Documentation Package</Text>

        {/* Accreditor Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text>
              <Text style={styles.label}>Accreditor: </Text>
              {data.accreditorName}
            </Text>
          </View>
          <View style={styles.row}>
            <Text>
              <Text style={styles.label}>Report Cycle: </Text>
              {data.reportCycle}
            </Text>
          </View>
          <View style={styles.row}>
            <Text>
              <Text style={styles.label}>Package Type: </Text>
              {packageTypeLabel}
            </Text>
          </View>
        </View>

        {/* Summary Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Institutional Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Total Enrollment</Text>
              <Text style={styles.summaryValue}>{data.totalEnrollment}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Faculty Count</Text>
              <Text style={styles.summaryValue}>{data.facultyCount}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Graduations (This Year)</Text>
              <Text style={styles.summaryValue}>{data.graduationCount}</Text>
            </View>
          </View>
        </View>

        {/* Program List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Programs</Text>
          {data.programs.length === 0 ? (
            <Text style={styles.noDataText}>No active programs found.</Text>
          ) : (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.colCode}>Code</Text>
                <Text style={styles.colName}>Program Name</Text>
                <Text style={styles.colCount}>Enrollment</Text>
              </View>
              {data.programs.map((program, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.colCode}>{program.code}</Text>
                  <Text style={styles.colName}>{program.name}</Text>
                  <Text style={styles.colCount}>{program.enrollmentCount}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footerSection}>
          <View style={styles.footerRow}>
            <Text>Generated: {data.generatedAt}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text>{data.institutionName}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text>
              This document is a preliminary data summary. Complete accreditation
              documentation may require additional narrative, supporting evidence,
              and institutional analysis.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderAccreditationPdfBuffer(
  data: AccreditationPackageData,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(<AccreditationDocument data={data} /> as any);
}
