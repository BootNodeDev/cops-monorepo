# /issue

Create a well-structured GitHub issue using `gh` CLI, driven by the repo's own issue templates.

---

## Behavior

### 1. Classify

Determine the issue type from the brief:

- **Bug** — something broken or behaving unexpectedly → `1-bug.yml`
- **Feature** — new capability or enhancement → `2-feature.yml`
- **Epic** — large body of work, decomposed into smaller issues → `3-epic.yml`
- **Spike** — time-boxed investigation to reduce uncertainty → `4-spike.yml`

If unclear, ask once: *"Is this a bug, feature, epic, or spike?"*

### 2. Read the template

Read `.github/ISSUE_TEMPLATE/<selected>.yml`. Extract:
- All fields (`id`, `label`, `description`, `placeholder`)
- Which are `required: true` vs optional
- The title prefix and label from the template header

This is your source of truth for the interview and the draft. Do not invent fields that aren't in the template.

### 3. Interview

Ask only for what's missing. If the brief already covers a required field, don't ask again.

Scale ceremony to issue weight — a small bugfix needs less interrogation than an epic. Required fields are the floor; optional fields are judgment calls based on context.

### 4. Draft

Produce the issue title and body. The body must mirror the template's field structure: use the field `label` as the section heading, maintain the field order, and include only sections that have content (omit empty optional fields).

Show the full draft to the user before touching GitHub.

### 5. Confirm

Wait for explicit approval. Iterate on feedback until approved.

### 6. Create

Write the body to a temp file, then create the issue:

```bash
cat > /tmp/gh_issue_body.md << 'EOF'
<body>
EOF

gh issue create \
  --title "<prefix><title>" \
  --label "<label>" \
  --body-file /tmp/gh_issue_body.md
```

Optional flags when relevant:
- `--assignee "<username>"`
- `--milestone "<name>"`
- `--project "<name>"`

Report back with the issue URL.
