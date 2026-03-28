import { Box, Text } from "ink";
import React from "react";

const TITLE_HORIZONTAL_PADDING = 6;

type ToastProps = {
  children: string;
};

export const Toast: React.FC<ToastProps> = ({ children }) => {
  const padding = " ".repeat(children.length + TITLE_HORIZONTAL_PADDING);
  const paddingHalf = " ".repeat(TITLE_HORIZONTAL_PADDING / 2);

  return (
    <Box flexDirection="column">
      <Text backgroundColor={"#eee"}>{padding}</Text>
      <Text bold backgroundColor={"#eee"} color={"#000"}>
        {paddingHalf}
        {children}
        {paddingHalf}
      </Text>
      <Text backgroundColor={"#eee"}>{padding}</Text>
    </Box>
  );
};
