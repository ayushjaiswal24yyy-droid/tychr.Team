"use strict";

module.exports = async (policyContext, config, { strapi }) => {
  if (!policyContext.state.user) {
    return false;
  }
  return true;
};
