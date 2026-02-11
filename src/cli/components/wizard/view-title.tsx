import React from "react";
import { Text } from "ink";

export type ViewTitleProps = {
  children: React.ReactNode;
};

export const ViewTitle: React.FC<ViewTitleProps> = ({ children }) => {
  return (
    <Text backgroundColor="yellow" bold color="#000">
      {" "}
      {children}{" "}
    </Text>
  );
};
