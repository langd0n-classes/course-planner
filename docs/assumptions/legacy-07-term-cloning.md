# Term Cloning

- **Dates are cleared on clone**: When cloning a term, all session dates and assessment due dates are set to null. The instructor must set new dates for the new term.

- **Prior art linking**: Cloned sessions automatically reference their source sessions in the `prior_art` array, enabling "what did I do last time?" queries.

- **Same instructor by default**: Clone defaults to the same instructor but accepts an optional `instructorId` override.
