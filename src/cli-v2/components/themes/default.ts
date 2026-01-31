import { extendTheme, defaultTheme } from "@inkjs/ui";

/**
 * CLI theme matching existing picocolors styling
 *
 * Color scheme:
 * - Cyan: Focus/primary (headings, prompts, selected items)
 * - Green: Success states
 * - Red: Errors
 * - Yellow: Warnings
 * - Blue: Info messages
 */
export const cliTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: () => ({ color: "cyan" }),
        label: () => ({ color: "gray" }),
      },
    },
    Select: {
      styles: {
        focusIndicator: () => ({ color: "cyan" }),
        label: ({ isFocused }) => ({
          color: isFocused ? "cyan" : undefined,
        }),
      },
    },
    MultiSelect: {
      styles: {
        focusIndicator: () => ({ color: "cyan" }),
        label: ({ isFocused, isSelected }) => ({
          color: isFocused ? "cyan" : isSelected ? "green" : undefined,
        }),
        checkboxChecked: () => ({ color: "green" }),
      },
    },
    StatusMessage: {
      styles: {
        container: ({ variant }) => ({
          borderStyle: "round",
          borderColor:
            variant === "error"
              ? "red"
              : variant === "warning"
                ? "yellow"
                : variant === "success"
                  ? "green"
                  : "blue",
        }),
      },
    },
    Alert: {
      styles: {
        container: ({ variant }) => ({
          borderColor:
            variant === "error"
              ? "red"
              : variant === "warning"
                ? "yellow"
                : variant === "success"
                  ? "green"
                  : "blue",
        }),
        icon: ({ variant }) => ({
          color:
            variant === "error"
              ? "red"
              : variant === "warning"
                ? "yellow"
                : variant === "success"
                  ? "green"
                  : "blue",
        }),
      },
    },
    TextInput: {
      styles: {
        container: ({ isFocused }) => ({
          borderColor: isFocused ? "cyan" : "gray",
        }),
        cursor: () => ({ color: "cyan" }),
      },
    },
    ConfirmInput: {
      styles: {
        highlightedChoice: () => ({ color: "cyan" }),
      },
    },
    Badge: {
      styles: {
        container: ({ variant }) => ({
          color:
            variant === "error"
              ? "red"
              : variant === "warning"
                ? "yellow"
                : variant === "success"
                  ? "green"
                  : variant === "info"
                    ? "blue"
                    : "cyan",
        }),
      },
    },
  },
});
