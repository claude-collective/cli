import React, { useMemo } from "react";
import { unique } from "remeda";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { Domain, MergedSkillsMatrix } from "../../types/index.js";
import { typedEntries } from "../../utils/typed-object.js";
import { CheckboxGrid, type CheckboxItem } from "./checkbox-grid.js";
import { getDomainDisplayName } from "./utils.js";

const BUILT_IN_DOMAIN_DESCRIPTIONS: Record<Domain, string> = {
  web: "Frontend web applications",
  api: "Backend APIs and services",
  cli: "Command-line tools",
  mobile: "Mobile applications",
  shared: "Shared utilities and methodology",
};

/** Built-in domain display order. Custom domains appear after these. */
const BUILT_IN_DOMAIN_ORDER: Domain[] = ["web", "api", "cli", "mobile"];

type DomainSelectionProps = {
  matrix: MergedSkillsMatrix;
};

export const DomainSelection: React.FC<DomainSelectionProps> = ({ matrix }) => {
  const { selectedDomains, toggleDomain, setStep, setApproach, selectStack } = useWizardStore();

  const availableDomains = useMemo((): CheckboxItem<Domain>[] => {
    const matrixDomains = unique(
      typedEntries(matrix.categories)
        .map(([, cat]) => cat?.domain)
        .filter((d): d is Domain => d != null && d !== "shared"),
    );

    const ordered: Domain[] = [
      ...BUILT_IN_DOMAIN_ORDER.filter((d) => matrixDomains.includes(d)),
      ...matrixDomains.filter((d) => !BUILT_IN_DOMAIN_ORDER.includes(d)),
    ];

    return ordered.map((domain) => ({
      id: domain,
      label: getDomainDisplayName(domain),
      description:
        BUILT_IN_DOMAIN_DESCRIPTIONS[domain] ?? `${getDomainDisplayName(domain)} skills`,
    }));
  }, [matrix]);

  const handleBack = () => {
    setApproach(null);
    selectStack(null);
  };

  return (
    <CheckboxGrid
      title="Select domains to configure"
      // subtitle="Select one or more domains, then continue"
      items={availableDomains}
      selectedIds={selectedDomains}
      onToggle={toggleDomain}
      onContinue={() => setStep("build")}
      onBack={handleBack}
      continueLabel={(count) => `Continue with ${count} domain(s)`}
      emptyMessage="Please select at least one domain"
    />
  );
};
