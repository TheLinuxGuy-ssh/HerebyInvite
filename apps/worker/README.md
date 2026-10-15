# Invitation generation worker

The worker turns a natural-language brief into an invitation in two explicit stages:

1. The model returns an `InvitationPlan` containing extracted facts, guest-facing copy, occasion-fit section order, and visual direction.
2. `compileInvitationPlan` deterministically converts that plan into the validated `SiteSpec` consumed by the renderer.

This boundary prevents the renderer from guessing content and makes unsupported sections or missing supporting data fail before publication.
