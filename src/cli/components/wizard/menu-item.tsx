import React from "react";
import { Box, Text } from "ink";

const CHEVRON = "\u276F";
const CHEVRON_SPACER = " ";

export type MenuItemProps = {
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
      <Text color={isFocused ? "cyan" : undefined}>{isFocused ? CHEVRON : CHEVRON_SPACER}</Text>
      <Text bold={isFocused} color={showCyan ? "cyan" : undefined}>
        {label}
      </Text>
      {isFocused && description && <Text dimColor>{` ${description}`}</Text>}
    </Box>
  );
};
