import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type PropsWithChildren,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";

import {
  HomeStartSpotlight,
  type HomeStartSpotlightProps,
} from "./HomeStartSpotlight";
import { setHomeStartSpotlightActive } from "./home-start-spotlight-chrome";

const SetHomeStartSpotlightContext = createContext<
  (value: HomeStartSpotlightProps | null) => void
>(() => undefined);

export function HomeStartSpotlightHost({ children }: PropsWithChildren) {
  const [spotlight, setSpotlight] = useState<HomeStartSpotlightProps | null>(
    null
  );
  const isVisible = Boolean(spotlight?.visible);

  useLayoutEffect(() => {
    setHomeStartSpotlightActive(isVisible);
    return () => setHomeStartSpotlightActive(false);
  }, [isVisible]);

  return (
    <SetHomeStartSpotlightContext.Provider value={setSpotlight}>
      <View style={styles.root}>
        {children}
        {spotlight ? <HomeStartSpotlight {...spotlight} /> : null}
      </View>
    </SetHomeStartSpotlightContext.Provider>
  );
}

export function HomeStartSpotlightLayer({
  visible,
  anchorRef,
  title,
  body,
  skipLabel,
  onSkip,
  onStart,
  layoutNonce = 0,
}: HomeStartSpotlightProps) {
  const setSpotlight = useContext(SetHomeStartSpotlightContext);
  const onSkipRef = useRef(onSkip);
  const onStartRef = useRef(onStart);
  onSkipRef.current = onSkip;
  onStartRef.current = onStart;

  useEffect(() => {
    if (!visible) {
      setSpotlight(null);
      return;
    }

    setSpotlight({
      visible: true,
      anchorRef,
      title,
      body,
      skipLabel,
      layoutNonce,
      onSkip: () => onSkipRef.current(),
      onStart: () => onStartRef.current(),
    });
    return () => setSpotlight(null);
  }, [anchorRef, body, layoutNonce, setSpotlight, skipLabel, title, visible]);

  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
