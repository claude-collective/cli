import React from "react";
import { Box, Text, useInput } from "ink";
import { CLI_COLORS } from "../../consts.js";

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
  useInput((_input, key) => {
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
        <Text color={CLI_COLORS.PRIMARY} bold>
          {technologyCount}
        </Text>{" "}
        technologies.
      </Text>
      <Text> </Text>

      <Box
        borderStyle="round"
        borderColor={isRecommendedSelected ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text
            color={isRecommendedSelected ? CLI_COLORS.SUCCESS : undefined}
            bold={isRecommendedSelected}
          >
            {isRecommendedSelected ? ">" : "○"} Use all recommended skills (verified){" "}
            <Text dimColor>{isRecommendedSelected ? "(Selected)" : "(Not selected)"}</Text>
          </Text>
          <Text> </Text>
          <Text dimColor>This is the fastest option. All skills are verified and</Text>
          <Text dimColor>maintained by Claude Collective.</Text>
        </Box>
      </Box>

      <Box
        borderStyle="round"
        borderColor={!isRecommendedSelected ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL}
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column">
          <Text
            color={!isRecommendedSelected ? CLI_COLORS.SUCCESS : undefined}
            bold={!isRecommendedSelected}
          >
            {!isRecommendedSelected ? ">" : "○"} Customize skill sources{" "}
            <Text dimColor>{!isRecommendedSelected ? "(Selected)" : "(Not selected)"}</Text>
          </Text>
          <Text> </Text>
          <Text dimColor>Choose alternative skills for each technology</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {"\u2191"}/{"\u2193"} navigate ENTER continue ESC back
        </Text>
      </Box>
    </Box>
  );
};
