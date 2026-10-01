import { useNavigation } from "expo-router/react-navigation";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/** A completed async operation must not act on a screen the user has left. */
export function useScreenOperationGuard(contextKey = "") {
  const navigation = useNavigation();
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const contextRef = useRef(contextKey);

  if (contextRef.current !== contextKey) {
    contextRef.current = contextKey;
    generationRef.current += 1;
  }

  useEffect(() => {
    mountedRef.current = true;
    const invalidate = () => {
      generationRef.current += 1;
    };
    const unsubscribeBlur = navigation.addListener("blur", invalidate);
    const unsubscribeRemove = navigation.addListener("beforeRemove", invalidate);

    return () => {
      mountedRef.current = false;
      invalidate();
      unsubscribeBlur();
      unsubscribeRemove();
    };
  }, [navigation]);

  return {
    captureGuard: () => {
      const generation = generationRef.current;
      return () =>
        mountedRef.current &&
        generationRef.current === generation &&
        AppState.currentState === "active" &&
        navigation.isFocused();
    },
    invalidate: () => {
      generationRef.current += 1;
    },
    isCurrent: () =>
      mountedRef.current && AppState.currentState === "active" && navigation.isFocused(),
    isMounted: () => mountedRef.current,
  };
}
