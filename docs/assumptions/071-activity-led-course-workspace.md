# Activity-led Course workspace (#71)

- The Activity board is the first design surface below the Course header.
  Learning Module editing, Term setup, and revision history remain available.
- Topic browsing is a secondary, collapsible Course-wide list. Legacy
  `Topic.learningModuleId` values do not define list groups or planning gaps.
- Topic content and prerequisites use a dedicated
  `/courses/[courseId]/topics/[topicId]` page because no existing Topic page
  route exists. The page uses the existing identity, DAG, and revision APIs.
  Topic creation remains available in the browser; coverage edits remain on
  Activity cards. Learning Outcome features are outside this change.
- A failed Topic save refreshes the displayed server revision and prerequisite
  chain while retaining the unsaved form values. The displayed revision shows
  which part of a partial save succeeded before the instructor retries.
