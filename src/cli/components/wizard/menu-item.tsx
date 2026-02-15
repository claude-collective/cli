import React from "react";
import { Box, Text } from "ink";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";

const { CHEVRON, CHEVRON_SPACER } = UI_SYMBOLS;

type MenuItemProps = {
  label: string;
  description?: string;
  isFocused?: boolean;
  isActive?: boolean;
};

export const MenuItem: React.FC<MenuItemProps> = ({
  label,
  description,
  isFocused = false,
  isActive = false,
}) => {
  const showCyan = isFocused || isActive;

  return (
    <Box columnGap={1}>
      <Text color={isFocused ? CLI_COLORS.PRIMARY : undefined}>
        {isFocused ? CHEVRON : CHEVRON_SPACER}
      </Text>
      <Text bold={isFocused} color={showCyan ? CLI_COLORS.PRIMARY : undefined}>
        {label}
      </Text>
      {isFocused && description && <Text dimColor>{` ${description}`}</Text>}
    </Box>
  );
};
