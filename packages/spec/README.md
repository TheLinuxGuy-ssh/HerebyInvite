# Invitation specification

This package owns the validated contracts used by generation and rendering:

- `InvitationPlan` is the model-facing interpretation contract.
- `SiteSpec` is the renderer-facing publication contract.
- `validateInvitationPlan` and `validateSpec` reject malformed or unsupported output before it is persisted.

Keep the plan and site contracts separate: the plan describes design intent, while `SiteSpec` describes the exact renderable result.
