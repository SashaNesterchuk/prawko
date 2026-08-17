import { ActionTile } from "./ActionTile";
import { type ActionTileItem } from "./ActionTileGrid";
import { ScreenSection } from "./ScreenSection";

type ActionTileSectionProps = {
  title: string;
  items: ActionTileItem[];
  testIDPrefix?: string;
};

export function ActionTileSection({
  title,
  items,
  testIDPrefix = "action-tile",
}: ActionTileSectionProps) {
  return (
    <ScreenSection title={title}>
      {items.map((item) => (
        <ActionTile
          key={item.key}
          title={item.title}
          subtitle={item.subtitle}
          accent={item.accent}
          premium={item.premium}
          style={item.style}
          icon={item.icon}
          onPress={item.onPress}
          testID={item.testID ?? `${testIDPrefix}-${item.key}`}
        />
      ))}
    </ScreenSection>
  );
}
