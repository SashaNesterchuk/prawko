import type { TopicBlockId } from "@prawko/config";

const MOCK_SECTION_COUNT = 4;

export function getTopicSections(_topicId: TopicBlockId): string[] {
  return Array.from({ length: MOCK_SECTION_COUNT }, (_, index) => `мок${index + 1}`);
}
