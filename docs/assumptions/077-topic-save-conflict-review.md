# Topic save conflict review (#77)

- If that refresh finds a different Topic version created by someone else, the
  editor compares the draft with the saved fields and blocks retry until the
  instructor chooses the saved version or explicitly keeps the draft. A failed
  refresh leaves the editor mounted and blocks retry until a reload succeeds.
