import React from "react";
import { Alert } from "@inkjs/ui";

export const InfoMessage: React.FC<{ children: string }> = ({ children }) => (
  <Alert variant="info">{children}</Alert>
);

export const WarningMessage: React.FC<{ children: string }> = ({
  children,
}) => <Alert variant="warning">{children}</Alert>;

export const ErrorMessage: React.FC<{ children: string }> = ({ children }) => (
  <Alert variant="error">{children}</Alert>
);

export const SuccessMessage: React.FC<{ children: string }> = ({
  children,
}) => <Alert variant="success">{children}</Alert>;
