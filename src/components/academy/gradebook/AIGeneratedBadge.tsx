import { Badge } from "@/components/ui/badge";

export function AIGeneratedBadge({ generated }: { generated: boolean }) {
  return generated ? <Badge variant="outline">AI suggestion</Badge> : null;
}
