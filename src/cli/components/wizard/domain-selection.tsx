import React, { useMemo } from "react";
import { unique } from "remeda";
import { useWizardStore } from "../../stores/wizard-store.js";
import { matrix } from "../../lib/matrix/matrix-provider.js";
import type { Domain } from "../../types/index.js";
import { typedEntries } from "../../utils/typed-object.js";
import { CheckboxGrid, type CheckboxItem } from "./checkbox-grid.js";
import { getDomainDisplayName, orderDomains } from "./utils.js";

const BUILT_IN_DOMAIN_DESCRIPTIONS: Record<Domain, string> = {
  web: "Frontend web applications",
  api: "Backend APIs and services",
  ai: "AI and LLM integrations",
  cli: "Command-line tools",
  mobile: "Mobile applications",
  infra: "CI/CD, deployment, and infrastructure",
  meta: "Code review and research methodology",
  shared: "Shared utilities and methodology",
};

export const DomainSelection: React.FC = () => {
  const { selectedDomains, toggleDomain, setStep, setApproach, selectStack, goBack } =
    useWizardStore();

  const availableDomains = useMemo((): CheckboxItem<Domain>[] => {
    const matrixDomains = unique(
      typedEntries(matrix.categories)
        .map(([, cat]) => cat?.domain)
        .filter((d): d is Domain => d != null),
    );

    const ordered = orderDomains(matrixDomains);

    return ordered.map((domain) => ({
      id: domain,
      label: getDomainDisplayName(domain),
      description: BUILT_IN_DOMAIN_DESCRIPTIONS[domain],
    }));
  }, [matrix]);

  const handleBack = () => {
    setApproach(null);
    selectStack(null);
    goBack();
  };

  return (
    <CheckboxGrid
      title="Select domains to configure"
      items={availableDomains}
      selectedIds={selectedDomains}
      onToggle={toggleDomain}
      onContinue={() => setStep("build")}
      onBack={handleBack}
      emptyMessage="Please select at least one domain"
    />
  );
};
