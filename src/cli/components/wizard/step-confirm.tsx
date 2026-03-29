import { Box, type DOMElement, measureElement, useInput } from "ink";
import React, { useEffect, useRef, useState } from "react";
import { CLI_COLORS, SCROLL_VIEWPORT } from "../../consts.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";
import { SkillAgentSummary } from "./skill-agent-summary.js";

type StepConfirmProps = {
  onComplete: () => void;
  skillConfigs?: SkillConfig[];
  agentConfigs?: AgentScopeConfig[];
  onBack?: () => void;
};

export const StepConfirm: React.FC<StepConfirmProps> = ({
  onComplete,
  skillConfigs,
  agentConfigs,
  onBack,
}) => {
  const { ref: scrollRef, measuredHeight } = useMeasuredHeight();

  const contentRef = useRef<DOMElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      const { height } = measureElement(contentRef.current);
      setContentHeight((prev) => (prev !== height ? height : prev));
    }
  });

  const scrollEnabled = measuredHeight >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS;
  const maxScroll = Math.max(0, contentHeight - measuredHeight);

  useInput((_input, key) => {
    if (key.return) {
      onComplete();
    }
    if (key.escape && onBack) {
      onBack();
    }
    if (!scrollEnabled) return;
    if (key.upArrow) setScrollOffset((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setScrollOffset((prev) => Math.min(maxScroll, prev + 1));
  });

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      flexGrow={1}
      flexBasis={0}
      borderStyle="single"
      borderColor={CLI_COLORS.NEUTRAL}
      borderDimColor
    >
      <Box ref={scrollRef} flexDirection="column" flexGrow={1} flexBasis={0}>
        <Box
          flexDirection="column"
          flexGrow={1}
          {...(scrollEnabled && { overflow: "hidden" as const })}
        >
          <Box
            ref={contentRef}
            flexDirection="column"
            marginTop={scrollOffset > 0 ? -scrollOffset : 0}
            {...(scrollEnabled && { flexShrink: 0 })}
          >
            <SkillAgentSummary skillConfigs={skillConfigs} agentConfigs={agentConfigs} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
