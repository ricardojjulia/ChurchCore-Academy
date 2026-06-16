import { Badge } from "@/components/ui/badge";

export function ConsentStatusBadge({ consentGranted }: { consentGranted: boolean }) {
  return (
    <Badge variant={consentGranted ? "secondary" : "outline"}>
      {consentGranted ? "Consent active" : "Consent required"}
    </Badge>
  );
}
