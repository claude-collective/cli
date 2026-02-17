import React from "react";
import { Box, Text } from "ink";
import { CLI_COLORS } from "../../consts.js";

const TITLE_HORIZONTAL_PADDING = 6;

type ViewTitleProps = {
  children: string;
};

export const ViewTitle: React.FC<ViewTitleProps> = ({ children }) => {
  const padding = " ".repeat(children.length + TITLE_HORIZONTAL_PADDING);
  const paddingHalf = " ".repeat(TITLE_HORIZONTAL_PADDING / 2);

  return (
    <Box marginBottom={1} flexDirection="column">
      <Text backgroundColor={CLI_COLORS.WARNING}>{padding}</Text>
      <Text backgroundColor={CLI_COLORS.WARNING} bold color="#000">
        {paddingHalf}
        {children}
        {paddingHalf}
      </Text>
      <Text backgroundColor={CLI_COLORS.WARNING}>{padding}</Text>
    </Box>
  );
};
