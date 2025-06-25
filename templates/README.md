# Liquid Templating API for etu

This document describes the context (variables, structures, and filters) available when writing Liquid templates for reporting with **etu**.

## How It Works

- Templates are regular [Liquid templates](https://shopify.github.io/liquid/), rendered with project and timesheet/session data.
- Use these variables and filters to create custom HTML/CSS (or text) reports.
- See `sample.liquid` for a full example.

---

## Context Variables

All variables below are available in every etu Liquid template (see src/commands/log/utils/gather.ts for source).

### `project`
- `.id`: string
- `.name`: string
- `.rate`: number (hourly rate)
- `.advance`: number (hours paid in advance)

### `sessions`
Array of session objects, **sorted by start time asc**. Each session:
- `.name`: string or null
- `.start`: number (ms since epoch)
- `.end`: number or null (ms since epoch, or null for ongoing)

### `time`
- Total time (in ms) from all ended sessions.

### `ongoingTime`
- Total time (in ms) of *all* currently running/ongoing sessions.

### `currency`
- string (e.g. `$` or `USD`).

### `currentSession`
- (session object) — if a session is currently running; otherwise null. Use as you would a session in `sessions`.

### `elapsed`
- Total time (in ms): `time + ongoingTime`.

### `decimalHours`
- Float (2 decimals): Total time in hours (e.g. `12.33`).

### `gross`
- Gross pay, *not deducting advance*. `decimalHours * project.rate`

### `advanceRemaining`
- ms remaining prepaid, only if advance used (else 0 or negative)

### `finalAmount`
- Money (number, 2 decimals). `(decimalHours - advance) * project.rate`

### `hoursExpr`
- Text showing calculation, e.g. `"(12.33 h - 10 h)"`

### `notes`
Array of memo and expense objects. Each:
- `.name`: string
- `.type`: "kv" (memo/info), or "expense"
- `.description`: string (kv memos) or detail/optional (expense)
- `.cost`: number (only for expenses)

### `totalExpenses`
- Sum of `cost` in notes where type == "expense"

### `finalWithExpenses`
- Final amount plus total expenses

### `now`
- Current timestamp in ms

---

## Useful Liquid Filters

### Built-in
- `date` — format timestamps (**note:** the value must be in seconds, so always divide millisecond values by 1000 before using, e.g. `{{ session.start | divided_by: 1000 | date: '%Y-%m-%d' }}`)
- `default` — fallback if value is blank/null
- `plus`, `minus`, `divided_by`, etc — basic math
- `where` — filter arrays by property (e.g. `{% assign expenses = notes | where: 'type', 'expense' %}`)

### Custom Filters

#### `humanReadable`
Format ms to readable durations (supports `ms`, `s`, `m`, `h`, e.g. `1h 27m`).
Example: `{{ elapsed | humanReadable }}`

---

## Sample Template

See [`sample.liquid`](./sample.liquid) for a full, annotated example: session table, expenses, memo, summary, etc.

---

## Authoring Tips
- **Always use `divided_by: 1000` before applying the `date` filter to ms-based timestamps.**
- Use `where` to filter for expenses (`type == 'expense'`), memos (`type == 'kv'`), etc.
- Final math is provided but you can compute/display any custom calculations using the fields above!

---

## Example Code Snippet

Filter and list all expenses:

```liquid
{% assign expenses = notes | where: 'type', 'expense' %}
{% for exp in expenses %}
  Expense: {{ exp.name }} for {{ currency }}{{ exp.cost }}
{% endfor %}
```

---

For more: see the source for [gather.ts](../src/commands/log/utils/gather.ts) and [render-liquid.ts](../src/commands/log/utils/render-liquid.ts).
