# Learning Module and Topic workspace editing (#66)

- Course workspace edits create a new draft version through the existing revision
  routes. Published versions and existing Activity/Term pins remain unchanged.
- Learning Module membership edits preserve the selected Activity version and its
  placement notes. New members use the Activity's current version; removing and
  adding an Activity explicitly can adopt its newer version. Membership order is
  saved as contiguous zero-based sequence values.
- Topic descriptions and change summaries belong to new Topic versions. Stable
  codes and prerequisites continue through their existing identity and DAG APIs.
- Publishing acts on the current saved Learning Module draft. It sets that
  version's publication time without creating another revision; unsaved editor
  changes must be saved first.
