# Frontend Rules

Use the local `naive-ui` skill before editing Vue or naive-ui frontend code under `web/`:

```text
.agents/skills/naive-ui/SKILL.md
```

For component-specific work, read the matching reference files in `.agents/skills/naive-ui/references/` before editing. Common examples:

- `component-button.md` for button variants, icon slots, and loading states.
- `component-display.md` for `NTag`, `NAvatar`, `NBadge`, `NStatistic`, and empty/result states.
- `component-feedback.md` and `component-feedback-alert.md` for messages, notifications, skeletons, popconfirms, and loading states.
- `component-layout.md` for `NCard`, `NFlex`, `NGrid`, `NSpace`, and dividers.
- `component-datatable.md` before replacing branch lists with tables.
- `core-theme.md` before changing theme overrides, dark mode, or theme variables.

Prefer naive-ui components and props over custom CSS when they provide the behavior directly. Keep custom CSS for product-specific layout, spacing, and visual identity that naive-ui does not cover cleanly.

When using provider APIs such as `useMessage`, `useDialog`, `useNotification`, or `useLoadingBar`, ensure the calling component is rendered inside the matching provider component.
