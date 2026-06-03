import { PeopleConfiguration } from "@/modules/people/types";
import { buildPeopleReviewModel } from "@/modules/people/review-view";

interface PeopleConfigurationReader {
  fetchPeopleConfiguration(tenantId: string): Promise<PeopleConfiguration>;
}

export async function loadPeopleReviewModel(repository: PeopleConfigurationReader, tenantId: string) {
  return buildPeopleReviewModel(await repository.fetchPeopleConfiguration(tenantId));
}
