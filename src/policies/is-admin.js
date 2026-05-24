"use strict";

module.exports = async (policyContext) => {
  const user = policyContext.state.user;

  if (!user) {
    return false;
  }

  const roleType = user.role?.type;
  const roleName = user.role?.name;

  return roleType === "admin" || roleName === "Admin" || roleName === "admin";
};
