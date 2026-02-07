/**
 * ViewTitle component - Orange/yellow background title for wizard steps.
 *
 * Renders a title with yellow background, dark text, and padding.
 * Used as headings across wizard steps for consistent styling.
 */
import React from "react";
import { Text } from "ink";

// =============================================================================
// Types
// =============================================================================

export interface ViewTitleProps {
  /** The title text to display */
  title: string;
}

// =============================================================================
// Component
// =============================================================================

export const ViewTitle: React.FC<ViewTitleProps> = ({ title }) => {
  return (
    <Text backgroundColor="yellow" bold color="#000">
      {" "}
      {title}{" "}
    </Text>
  );
};
