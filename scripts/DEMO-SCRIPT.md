# RegTranslate Product Demo — Recording Script

For TV / poster-style playback. Full-screen the demo recorder and record your screen.

## Setup

1. Start the backend: `uvicorn app.main:app --reload`
2. Start the frontend: `cd react-ui && npm run dev`
3. Open `scripts/demo-recorder.html` in a browser (Chrome recommended)
4. Full-screen the demo page (F11)
5. Start your screen recorder (OBS, QuickTime, Loom, etc.)

## Demo Flow (sync with on-screen messages)

| Scene | Message on screen | What to do |
|-------|-------------------|------------|
| 1 | RegTranslate — Convert regulatory PDFs... | Show app overview, no action |
| 2 | 1. Select Regulation & Upload | Pick HIPAA (or GDPR), select a PDF file |
| 3 | 2. Process Document | Click **Process**, wait for completion |
| 4 | 3. Extract Tasks | Click **Extract tasks**, wait for tasks to load |
| 5 | 4. Review & Edit | Select a few tasks, maybe expand one, show edit |
| 6 | 5. Export to Jira | Enter project key, click **Export to Jira** (or skip if no Jira) |
| 7 | 6. Export to GitHub | Click **Export to GitHub** (or skip) |
| 8 | Settings | Open Settings, show API config & Clear data |
| 9 | Compliance Q&A | Ask a question in the Q&A panel |

## Tips

- Use **Next** / **Previous** to advance scenes manually if needed
- Zoom is automatic: normal → zoom-in → zoom-focus on key steps
- Keep demo under 2 minutes for TV loop
- Pre-load a PDF so processing is quick during recording
