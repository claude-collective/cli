import React from "react";
import { Box, Text, useInput } from "ink";

export type RefineAction = "all-recommended" | "customize" | null;

export type StepRefineProps = {
  technologyCount: number;
  refineAction: RefineAction;
  onSelectAction: (action: "all-recommended" | "customize") => void;
  onContinue: () => void;
  onBack: () => void;
};

export const StepRefine: React.FC<StepRefineProps> = ({
  technologyCount,
  refineAction,
  onSelectAction,
  onContinue,
  onBack,
}) => {
  useInput((input, key) => {
    if (key.return) {
      onContinue();
    }
    if (key.escape) {
      onBack();
    }
    if (key.upArrow || key.downArrow) {
      onSelectAction(refineAction === "all-recommended" ? "customize" : "all-recommended");
    }
  });

  const isRecommendedSelected = refineAction === "all-recommended" || refineAction === null;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text>
        Your stack includes{" "}
        <Text color="cyan" bold>
          {technologyCount}
        </Text>{" "}
        technologies.
      </Text>
      <Text> </Text>

      <Box
        borderStyle="round"
        borderColor={isRecommendedSelected ? "green" : "gray"}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color={isRecommendedSelected ? "green" : undefined} bold={isRecommendedSelected}>
            {isRecommendedSelected ? ">" : "○"} Use all recommended skills (verified)
          </Text>
          <Text> </Text>
          <Text dimColor>This is the fastest option. All skills are verified and</Text>
          <Text dimColor>maintained by Claude Collective.</Text>
        </Box>
      </Box>

      <Box
        borderStyle="round"
        borderColor={!isRecommendedSelected ? "green" : "gray"}
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column">
          <Text color={!isRecommendedSelected ? "green" : undefined} bold={!isRecommendedSelected}>
            {!isRecommendedSelected ? ">" : "○"} Customize skill sources
          </Text>
          <Text> </Text>
          <Text dimColor>Choose alternative skills for each technology</Text>
        </Box>
      </Box>
    </Box>
  );
};
