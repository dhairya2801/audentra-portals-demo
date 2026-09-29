# Guide decisions and preserved product behavior

Reference: attached `audentra-style-guide-v2.html` (the file itself labels its guide v1.1). Its foundations/components/product sections were rendered, and the live site was used as a visual reference. Functionality comes from the committed `audentra-vnext` code.

## Adopted

| Guide direction | Implementation and reason |
| --- | --- |
| Audentra Purple `#6A38FF`, Deep Navy `#0A1F44` | Purple primary actions/selection and navy structural/text accents give both portals one recognizable identity. |
| Royal Blue and Teal semantics | Blue information and teal success families; darker foreground variants ensure readable text on light surfaces. Bright brand colors are not automatically suitable text colors. |
| Neutral surfaces and clear status treatments | Quiet page canvas, white cards, consistent borders and restrained semantic fills make priorities easier to scan. |
| Phosphor iconography | Reused the installed icon component for staff navigation; no dependency/framework migration. Edward's E and existing institution marks remain untouched. |
| Institution identity plus Audentra attribution | Staff header now leads with the tenant institution, with quiet Powered by Audentra attribution in the existing sidebar note. Original Edward view identity remains untouched. |
| Consistent controls, spacing and feedback | Shared semantic tokens, restrained radii/elevation, focus rings, flat primary buttons, coherent fields/dialogs and mobile touch sizes extend the current component system. |
| Clear financial hierarchy | Tabular amounts, stronger amount/label contrast and a single-column phone comparison layout make relationships easier to read. |

## Adapted or deliberately ignored

| Guide rule/example | Decision and practical reason |
| --- | --- |
| Montserrat everywhere | Retained existing Geist for student/embedded content and staff headings; retained inherited staff Satoshi body and institution serif marks. A temporary Montserrat trial on actual task cards and financial figures was saved in the evidence folder. Its wider, more geometric character does not help compact operational content enough to justify a second font migration or risk inherited Edward changes. |
| Universal heading scale and minimum metadata size | Used 25–28px staff page headings, 13–14px working text and compact 10–11px board labels where necessary. Dense columns need clear hierarchy without forcing extra wrapping everywhere. Large values remain prominent. |
| Fixed color percentages | Assigned color by meaning and interaction priority. A screen full of statuses should not be recolored to meet an arbitrary brand ratio. |
| Narrow/fixed content containers | Preserved the wide staff workspace, directory/record split and horizontally scrollable board. Operational screens need room for comparison. |
| Gradient borders and uniform large cards | The student purple headers, white typography and motifs are retained following user review. Header/summary sizing and overlap now follow Enrollment through one shared presentation file, including Financials. Other surfaces use modest borders/shadows; existing useful editorial/brand treatments remain. Every financial amount or staff card does not need equal visual emphasis. |
| Identical card anatomy across products | Shared surfaces and type rules; retained different structures for tasks, progress, editorial briefs and financial comparisons. Their users need different information densities. |
| Guide's sample modules, fields, Action Center, rewards, SLA values, dates and forecasts | None were treated as product requirements. No module was restored, no reward invented, and no fact or behavior was changed to match a mockup. Existing examples already implemented in the committed product remain with their existing data provenance. |
| New theme or density controls | No feature was added. Existing light theme and the board's existing compact mode remain supported. |
| Guide's Edward styling, icons, cards and controls | Entirely excluded because the user's explicit exception takes precedence. Even existing Ask Edward controls retain their original appearance. |

## Kept from the website, and why

- **Navigation hierarchy and module membership:** familiar destinations and Workspace/Developing organization are preserved. The committed product already contains a Developing/Action Center entry and Morning Brew action-center content; neither was added from the guide.
- **Jira-style Task Board:** same board/list views, seven board configurations, columns, cards, filters, group/sort controls, details, workflow/activity and original drag/drop handlers. These are the staff working model, not decoration to replace.
- **Morning Brew:** same setup/customization sequence, editorial greeting, content sections, popups, figures and source/date/demo disclaimers. This committed version is demo-backed; unrelated uncommitted live-connection work was excluded.
- **Student 360:** same student directory, selected-record structure, summaries, disclosures and record tabs. Staff must retain their familiar path from identity to supporting detail.
- **Enrollment:** same progress, ordering/sorting, office ownership, grouped tasks, requirement routes, drawer actions and actual existing reward rail. These express real rules and progress; a visual guide cannot redefine them.
- **Financials:** same nine sections, calculations, tables, budget planning and distinctions between posted facts, anticipated aid and estimates. Better presentation does not authorize changing the underlying financial model.
- **Authentication/onboarding and institution marks:** existing identity and sequence are retained. Opted-in presentation now covers all ten onboarding screens; a narrowly handled missing university-profile read fixes new-account opening without changing backend rules. No new required field or step was inferred from sample screens.
- **Edward and its dependencies:** source files, legacy tokens/styles, inherited root fonts, contextual controls and backend behavior are preserved. Shared tooltips outside the portal boundary also stay as-is because restyling them could affect Edward.
- **Backend, permissions, data and integration contracts:** unchanged. The refresh neither substitutes mock records for connected data nor imports data/logic from the guide.

Student summary advisor placeholders now use a decorative illustrated portrait in the guide’s simple person style, with a single greeting animation and reduced-motion support. Actual record photos, contact names/actions and shared/Edward avatars remain untouched. The same header/summary rules apply across student sections; long record notes can increase height, and sections without a summary do not receive a new one.

One small resilience improvement accompanies styling: missing Morning Brew news images fall back to the existing publisher mark. This avoids broken artwork while retaining the same news content and links.
