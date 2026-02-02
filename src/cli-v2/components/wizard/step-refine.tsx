/**
 * StepRefine component - Refine step for skill source selection.
 *
 * For Phase 7, this implements only the "Use all recommended" path.
 * The "Customize" option (skills.sh integration) is deferred to Phase 8.
 *
 * Visual design:
 * - Prominent "Use all recommended" option with border (default/selected)
 * - Grayed out "Customize" option with "(coming soon)" label
 * - Keyboard navigation: Enter to continue, Escape to go back
 */
import React from "react";
import { Box, Text, useInput } from "ink";

// =============================================================================
// Types
// =============================================================================

export type RefineAction = "all-recommended" | "customize" | null;

export interface StepRefineProps {
  /** Count of selected technologies */
  technologyCount: number;
  /** Current selection: use all recommended or customize */
  refineAction: RefineAction;
  /** Callback when action is selected */
  onSelectAction: (action: RefineAction) => void;
  /** Continue to confirm step */
  onContinue: () => void;
  /** Go back to build step */
  onBack: () => void;
}

// =============================================================================
// Main Component
// =============================================================================

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
    // Arrow keys to move between options (for future)
    // For now, only "all-recommended" is selectable
    if (key.upArrow || key.downArrow) {
      onSelectAction("all-recommended");
    }
  });

  // Determine if "all-recommended" is the current selection
  // Default to "all-recommended" if nothing selected
  const isRecommendedSelected = refineAction === "all-recommended" || refineAction === null;

  return (
    <Box flexDirection="column" paddingX={2}>
      {/* Technology count header */}
      <Text>
        Your stack includes{" "}
        <Text color="cyan" bold>
          {technologyCount}
        </Text>{" "}
        technologies.
      </Text>
      <Text> </Text>

      {/* Recommended option - highlighted with border */}
      <Box
        borderStyle="round"
        borderColor={isRecommendedSelected ? "green" : "gray"}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color="green" bold>
            {">"} Use all recommended skills (verified)
          </Text>
          <Text> </Text>
          <Text dimColor>
            This is the fastest option. All skills are verified and
          </Text>
          <Text dimColor>maintained by Claude Collective.</Text>
        </Box>
      </Box>

      {/* Customize option - disabled/grayed */}
      <Box paddingLeft={2}>
        <Text dimColor>
          {"○"} Customize skill sources <Text color="gray">(coming soon)</Text>
        </Text>
      </Box>
      <Box paddingLeft={4}>
        <Text dimColor>Choose alternative skills for each technology</Text>
      </Box>

      {/* Footer with keyboard shortcuts */}
      <Text> </Text>
      <Text dimColor>
        {"\u2191"}/{"\u2193"} navigate   ENTER continue   ESC back
      </Text>
    </Box>
  );
};
