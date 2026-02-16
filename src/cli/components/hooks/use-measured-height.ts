import { useRef, useState, useEffect } from "react";
import { type DOMElement, measureElement, useStdout } from "ink";

/**
 * Measures the computed height of a Box element using Ink's Yoga layout engine.
 *
 * Returns a ref to attach to a Box with `flexGrow={1}` and the measured height.
 * The Box must be inside a parent chain with a constrained height (e.g., an
 * explicit `height` prop on an ancestor) so Yoga can compute the remaining space.
 *
 * Returns 0 before the first layout pass. Re-measures on terminal resize.
 */
export function useMeasuredHeight(): {
  ref: React.Ref<DOMElement>;
  measuredHeight: number;
} {
  const ref = useRef<DOMElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const { stdout } = useStdout();

  useEffect(() => {
    const measure = () => {
      if (ref.current) {
        const { height } = measureElement(ref.current);
        setMeasuredHeight((prev) => (prev !== height ? height : prev));
      }
    };

    measure();

    stdout.on("resize", measure);
    return () => {
      stdout.off("resize", measure);
    };
  }, [stdout]);

  return { ref, measuredHeight };
}
