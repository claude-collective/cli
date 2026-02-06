/**
 * WizardFooter component - Shared footer with split layout for navigation hints.
 *
 * Uses `justifyContent="space-between"` pattern for left/right alignment:
 * - Left side: navigation controls (arrows, SPACE, etc.)
 * - Right side: action hints (ESC, ENTER)
 */
import React from "react";
import { Box, Text } from "ink";

// =============================================================================
// Types
// =============================================================================

export interface WizardFooterProps {
  /** Left side: navigation controls (e.g., "up/down navigate  ENTER select") */
  navigation: string;
  /** Right side: action hints (e.g., "ESC cancel") */
  action: string;
}

// =============================================================================
// Component
// =============================================================================

export const WizardFooter: React.FC<WizardFooterProps> = ({
  navigation,
  action,
}) => {
  return (
    <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
      <Text dimColor>{navigation}</Text>
      <Text dimColor>{action}</Text>
    </Box>
  );
};
