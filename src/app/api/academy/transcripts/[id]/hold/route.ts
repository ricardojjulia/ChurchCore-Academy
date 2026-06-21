import { transitionTranscriptRequest } from "../revoke/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return transitionTranscriptRequest(request, { params }, "hold");
}
