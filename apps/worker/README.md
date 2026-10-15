# Invitation generation worker

The worker turns a natural-language brief into an invitation in two explicit stages:

1. The intake model returns a `BriefIntake` containing extracted facts and structured follow-up questions. Questions declare whether the host should choose one option, choose multiple options, or write a free-form answer.
2. Critical fact and design-direction guards add questions when the model misses them. The system does not silently invent a theme, mood, copy tone, imagery direction, or motion style.
3. After the host answers, the model returns an `InvitationPlan` containing extracted facts, guest-facing copy, occasion-fit section order, and visual direction.
4. `compileInvitationPlan` deterministically converts that plan into the validated `SiteSpec` consumed by the renderer.

This boundary prevents the renderer from guessing content and makes unsupported sections or missing supporting data fail before publication. It also keeps design intent explicit instead of hiding it in a generic prompt.
