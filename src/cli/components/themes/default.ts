import { extendTheme, defaultTheme } from "@inkjs/ui";
import { CLI_COLORS } from "../../consts.js";

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
        frame: () => ({ color: CLI_COLORS.PRIMARY }),
        label: () => ({ color: CLI_COLORS.NEUTRAL }),
      },
    },
    Select: {
      styles: {
        focusIndicator: () => ({ color: CLI_COLORS.FOCUS }),
        label: ({ isFocused }) => ({
          color: isFocused ? CLI_COLORS.FOCUS : undefined,
        }),
      },
    },
    MultiSelect: {
      styles: {
        focusIndicator: () => ({ color: CLI_COLORS.FOCUS }),
        label: ({ isFocused, isSelected }) => ({
          color: isFocused ? CLI_COLORS.FOCUS : isSelected ? CLI_COLORS.SUCCESS : undefined,
        }),
        checkboxChecked: () => ({ color: CLI_COLORS.SUCCESS }),
      },
    },
    StatusMessage: {
      styles: {
        container: ({ variant }) => ({
          borderStyle: "round",
          borderColor:
            variant === "error"
              ? CLI_COLORS.ERROR
              : variant === "warning"
                ? CLI_COLORS.WARNING
                : variant === "success"
                  ? CLI_COLORS.SUCCESS
                  : CLI_COLORS.INFO,
        }),
      },
    },
    Alert: {
      styles: {
        container: ({ variant }) => ({
          borderColor:
            variant === "error"
              ? CLI_COLORS.ERROR
              : variant === "warning"
                ? CLI_COLORS.WARNING
                : variant === "success"
                  ? CLI_COLORS.SUCCESS
                  : CLI_COLORS.INFO,
        }),
        icon: ({ variant }) => ({
          color:
            variant === "error"
              ? CLI_COLORS.ERROR
              : variant === "warning"
                ? CLI_COLORS.WARNING
                : variant === "success"
                  ? CLI_COLORS.SUCCESS
                  : CLI_COLORS.INFO,
        }),
      },
    },
    TextInput: {
      styles: {
        container: ({ isFocused }) => ({
          borderColor: isFocused ? CLI_COLORS.FOCUS : CLI_COLORS.NEUTRAL,
        }),
        cursor: () => ({ color: CLI_COLORS.PRIMARY }),
      },
    },
    ConfirmInput: {
      styles: {
        highlightedChoice: () => ({ color: CLI_COLORS.PRIMARY }),
      },
    },
    Badge: {
      styles: {
        container: ({ variant }) => ({
          color:
            variant === "error"
              ? CLI_COLORS.ERROR
              : variant === "warning"
                ? CLI_COLORS.WARNING
                : variant === "success"
                  ? CLI_COLORS.SUCCESS
                  : variant === "info"
                    ? CLI_COLORS.INFO
                    : CLI_COLORS.PRIMARY,
        }),
      },
    },
  },
});
