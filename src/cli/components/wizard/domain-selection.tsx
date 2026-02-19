import React from "react";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { Domain } from "../../types/index.js";
import { CheckboxGrid, type CheckboxItem } from "./checkbox-grid.js";

const AVAILABLE_DOMAINS: CheckboxItem<Domain>[] = [
  { id: "web", label: "Web", description: "Frontend web applications" },
  { id: "api", label: "API", description: "Backend APIs and services" },
  { id: "cli", label: "CLI", description: "Command-line tools" },
  { id: "mobile", label: "Mobile", description: "Mobile applications" },
];

export const DomainSelection: React.FC = () => {
  const { selectedDomains, toggleDomain, setStep, setApproach, selectStack } = useWizardStore();

  const handleBack = () => {
    setApproach(null);
    selectStack(null);
  };

  return (
    <CheckboxGrid
      title="Select domains to configure"
      // subtitle="Select one or more domains, then continue"
      items={AVAILABLE_DOMAINS}
      selectedIds={selectedDomains}
      onToggle={toggleDomain}
      onContinue={() => setStep("build")}
      onBack={handleBack}
      continueLabel={(count) => `Continue with ${count} domain(s)`}
      emptyMessage="Please select at least one domain"
    />
  );
};
