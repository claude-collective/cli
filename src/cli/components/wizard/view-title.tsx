import React from "react";
import { Text } from "ink";
import { CLI_COLORS } from "../../consts.js";

type ViewTitleProps = {
  children: React.ReactNode;
};

export const ViewTitle: React.FC<ViewTitleProps> = ({ children }) => {
  return (
    <Text backgroundColor={CLI_COLORS.WARNING} bold color="#000">
      {" "}
      {children}{" "}
    </Text>
  );
};
