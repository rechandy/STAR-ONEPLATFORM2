// ============================================================================
// OnePlatform authorization policies (Cedar) — student access.
// See docs/adr/0005-cedar-authorization.md. Default is DENY; access is granted
// only by an explicit permit below. Every rule is tenant-scoped first.
// ============================================================================

// (1) Shared-class access: any staff member (teacher, co-teacher, specialist,
//     aide) may VIEW a student they share at least one class with.
//     This is the relationship that produces cross-teacher access.
permit (
  principal,
  action == Action::"viewStudent",
  resource
)
when {
  principal.tenant == resource.tenant &&
  principal.classes.containsAny(resource.classes)
};

// (2) Recording student data is narrower: shared class AND an instructional
//     role. Admins do NOT get data-entry rights from this rule.
permit (
  principal,
  action == Action::"recordStudentData",
  resource
)
when {
  principal.tenant == resource.tenant &&
  principal.classes.containsAny(resource.classes) &&
  ["TEACHER", "SPECIALIST", "AIDE"].contains(principal.role)
};

// (3) District admins may VIEW any student in their own tenant.
permit (
  principal,
  action == Action::"viewStudent",
  resource
)
when {
  principal.tenant == resource.tenant &&
  principal.role == "DISTRICT_ADMIN"
};

// (4) School admins may VIEW students in a school they administer.
permit (
  principal,
  action == Action::"viewStudent",
  resource
)
when {
  principal.tenant == resource.tenant &&
  principal.role == "ADMINISTRATOR" &&
  principal.schools.contains(resource.school)
};

// (5) District admins may MANAGE the roster (provision users) anywhere in tenant.
permit (
  principal,
  action == Action::"manageRoster",
  resource
)
when {
  principal.tenant == resource.tenant &&
  principal.role == "DISTRICT_ADMIN"
};

// (6) School admins may MANAGE the roster of a school they administer.
permit (
  principal,
  action == Action::"manageRoster",
  resource
)
when {
  principal.tenant == resource.tenant &&
  principal.role == "ADMINISTRATOR" &&
  principal.schools.contains(resource.orgId)
};
